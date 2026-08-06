import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { Database, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Product imagery: the Storage object and the `product_images` row that points
 * at it.
 *
 * The two have to move together. An upload with no row is an orphaned file
 * nobody can find; a row with no object is a broken image on the storefront.
 * Every function here does both, in the order that fails safest — upload before
 * insert, delete the row before the object — so an interruption leaves an
 * orphaned file rather than a broken page.
 */

/** The five buckets migration 000800 creates. */
export const BUCKETS = {
  products: "products",
  brands: "brands",
  avatars: "avatars",
  banners: "banners",
  siteAssets: "site-assets",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/webp",
  "image/avif",
  "image/jpeg",
  "image/png",
] as const;

/**
 * Validates before the network call.
 *
 * The bucket enforces its own size and MIME limits, and that is the real
 * boundary — but a 5 MB upload that fails server-side has already cost the
 * operator the upload. Checking first is a courtesy, not the control.
 */
function assertUploadable(file: File): void {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError("validation", "That image is larger than 5 MB.");
  }

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError("validation", "Images must be WebP, AVIF, JPEG or PNG.");
  }
}

/**
 * A storage key for a product image.
 *
 * Prefixed with the product id so a product's files are one folder — which is
 * what makes a folder-scoped RLS policy expressible — and suffixed with a random
 * segment so re-uploading the same filename cannot overwrite a live image.
 */
export function productImagePath(productId: string, file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "webp";
  const unique = crypto.randomUUID().slice(0, 8);

  return `${productId}/${Date.now()}-${unique}.${extension}`;
}

export async function uploadProductImage(
  supabase: Client,
  productId: string,
  file: File,
  options: { altText?: string | null; makePrimary?: boolean } = {},
): Promise<Tables<"product_images">> {
  assertUploadable(file);

  const path = productImagePath(productId, file);

  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.products)
    .upload(path, file, {
      contentType: file.type,
      // Never overwrite: the path is unique by construction, so an existing
      // object at this key means something is wrong and should be loud.
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) throw toAppError(uploadError, "upload the image");

  const { data: existing, error: countError } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId);

  if (countError) throw toAppError(countError, "read the existing images");

  const isFirst = (existing ?? []).length === 0;

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      storage_path: path,
      alt_text: options.altText ?? null,
      display_order: (existing ?? []).length,
      // The first image is primary whether or not the caller asked: a product
      // with images but no primary renders no thumbnail anywhere.
      is_primary: options.makePrimary === true || isFirst,
    })
    .select()
    .single();

  if (error) {
    // The row failed, so the object is unreferenced. Remove it rather than
    // leaving a file nothing points at.
    await supabase.storage.from(BUCKETS.products).remove([path]);
    throw toAppError(error, "save the image");
  }

  if (options.makePrimary === true && !isFirst) {
    await setPrimaryImage(supabase, productId, data.id);
  }

  return data;
}

/**
 * Deletes an image row, and the object **only if nothing else points at it**.
 *
 * `duplicateProduct` copies image rows without copying files, so two products
 * can share one object. Deleting the file with the first row would break the
 * copy — a bug that would surface much later, on a different product.
 */
export async function deleteProductImage(
  supabase: Client,
  imageId: string,
): Promise<void> {
  const { data: image, error: loadError } = await supabase
    .from("product_images")
    .select("id, storage_path, product_id, is_primary")
    .eq("id", imageId)
    .maybeSingle();

  if (loadError) throw toAppError(loadError, "load the image");
  if (!image) throw notFoundOrForbidden("Image");

  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);

  if (deleteError) throw toAppError(deleteError, "delete the image");

  const { data: others, error: refError } = await supabase
    .from("product_images")
    .select("id")
    .eq("storage_path", image.storage_path)
    .limit(1);

  if (refError) throw toAppError(refError, "check for other references");

  if ((others ?? []).length === 0) {
    const { error } = await supabase.storage
      .from(BUCKETS.products)
      .remove([image.storage_path]);

    // A failed object delete leaves a harmless orphan; the row is already gone
    // and the UI is correct. Not worth failing the operation over.
    if (error) console.error("[storage] orphaned object", image.storage_path);
  }

  // Deleting the primary leaves the product with none, so promote the first
  // remaining image rather than leaving the card without a thumbnail.
  if (image.is_primary) {
    const { data: remaining } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("display_order", { ascending: true })
      .limit(1);

    const next = remaining?.[0];
    if (next) await setPrimaryImage(supabase, image.product_id, next.id);
  }
}

/**
 * Replaces the file behind an image, keeping the row and its alt text.
 *
 * Uploads the new object before deleting the old one: the reverse order leaves
 * the product imageless if the upload fails.
 */
export async function replaceProductImage(
  supabase: Client,
  imageId: string,
  file: File,
): Promise<Tables<"product_images">> {
  assertUploadable(file);

  const { data: image, error: loadError } = await supabase
    .from("product_images")
    .select("id, storage_path, product_id")
    .eq("id", imageId)
    .maybeSingle();

  if (loadError) throw toAppError(loadError, "load the image");
  if (!image) throw notFoundOrForbidden("Image");

  const path = productImagePath(image.product_id, file);

  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.products)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) throw toAppError(uploadError, "upload the replacement");

  const { data, error } = await supabase
    .from("product_images")
    .update({ storage_path: path, width: null, height: null })
    .eq("id", imageId)
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKETS.products).remove([path]);
    throw toAppError(error, "update the image");
  }

  const { data: others } = await supabase
    .from("product_images")
    .select("id")
    .eq("storage_path", image.storage_path)
    .limit(1);

  if ((others ?? []).length === 0) {
    await supabase.storage.from(BUCKETS.products).remove([image.storage_path]);
  }

  return data;
}

/**
 * Persists a new gallery order.
 *
 * One update per image, issued concurrently — same reasoning as
 * `reorderCategories`: PostgREST's upsert needs every non-defaulted column, so
 * a partial upsert here would insert an image row with no `storage_path`.
 */
export async function reorderProductImages(
  supabase: Client,
  order: { id: string; display_order: number }[],
): Promise<void> {
  if (order.length === 0) return;

  const results = await Promise.all(
    order.map(({ id, display_order }) =>
      supabase.from("product_images").update({ display_order }).eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw toAppError(failed.error, "save the image order");
}

/**
 * Promotes one image to primary.
 *
 * Two statements, and the demotion runs first — so an interruption leaves the
 * product with no primary rather than two, which the promotion step then fixes
 * on retry. Two primaries would make the thumbnail non-deterministic.
 */
export async function setPrimaryImage(
  supabase: Client,
  productId: string,
  imageId: string,
): Promise<void> {
  const { error: clearError } = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .neq("id", imageId);

  if (clearError) throw toAppError(clearError, "update the primary image");

  const { error } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);

  if (error) throw toAppError(error, "set the primary image");
}

/**
 * Uploads a category's image and returns its storage **path**.
 *
 * Path, not URL, because that is what `categories.image_path` holds — the same
 * convention every image column in this schema follows. A stored URL bakes in
 * the project hostname and the bucket's public/private state, both of which can
 * change; a path resolves against whichever is current at render time.
 *
 * Into `site-assets` rather than `products`: a category image is site chrome,
 * and the `products` bucket's policies are scoped to catalog imagery.
 *
 * Unlike `uploadProductImage` there is **no row to insert** — the path is a
 * column on `categories`, so the caller writes it with the rest of the form.
 * That means an upload whose save is then abandoned leaves an orphaned object,
 * which is a few kilobytes rather than a correctness problem, and is the trade
 * for the operator seeing the image before committing to it.
 */
export async function uploadCategoryImage(
  supabase: Client,
  categoryId: string,
  file: File,
): Promise<string> {
  assertUploadable(file);

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "webp";
  const unique = crypto.randomUUID().slice(0, 8);
  const path = `categories/${categoryId}/${Date.now()}-${unique}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKETS.siteAssets)
    .upload(path, file, {
      contentType: file.type,
      // The key is unique by construction, so an object already there means
      // something is wrong and should be loud rather than overwritten.
      upsert: false,
      cacheControl: "31536000",
    });

  if (error) throw toAppError(error, "upload the category image");

  return path;
}

/**
 * Removes a category's image object.
 *
 * Best-effort by design: the column is cleared by the caller's update, and a
 * failure to delete the file must not fail that update. An object nothing points
 * at is storage waste; a category whose image field could not be cleared is a
 * screen the operator cannot fix.
 */
export async function deleteCategoryImage(
  supabase: Client,
  path: string,
): Promise<void> {
  await supabase.storage.from(BUCKETS.siteAssets).remove([path]);
}

/**
 * A public URL for an object in a public bucket.
 *
 * Synchronous and free — it is string construction, not a request. Use
 * `createSignedUrl` for `avatars`, which is private.
 */
export function publicUrl(
  supabase: Client,
  bucket: BucketName,
  path: string,
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * A time-limited URL for a private object.
 *
 * `avatars` is the only private bucket. The default hour is deliberately short:
 * a signed URL is a bearer token, and one that outlives the page that needed it
 * is a link that keeps working after access is revoked.
 */
export async function signedUrl(
  supabase: Client,
  bucket: BucketName,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw toAppError(error, "sign the file URL");

  return data.signedUrl;
}
