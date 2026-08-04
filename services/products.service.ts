import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type {
  Database,
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";

/**
 * Product reads and writes.
 *
 * Takes the client rather than creating one (see `services/README.md`): the
 * caller decides whether the query runs as the visitor with RLS enforced
 * (`supabase/server.ts`) or as the service role with RLS bypassed
 * (`supabase/admin.ts`). A service that picks for itself is a service that
 * quietly bypasses authorisation the first time someone reuses it.
 *
 * **Selects are explicit, never `*`.** A `*` re-shapes silently when a column is
 * added, ships `search_vector` — a `tsvector` nobody renders — over the wire on
 * every row, and defeats the generated types' ability to tell the caller what it
 * actually got.
 */

type Client = SupabaseClient<Database>;

/** Columns a listing needs. Deliberately narrower than the detail select. */
const LIST_COLUMNS = `
  id, slug, sku, name, short_description, price_cents, sale_price_cents,
  status, visibility, is_featured, published_at, updated_at,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug ),
  inventory ( quantity_on_hand, quantity_reserved, low_stock_threshold )
` as const;

const DETAIL_COLUMNS = `
  id, slug, sku, name, description, short_description,
  price_cents, sale_price_cents, cost_price_cents,
  status, visibility, is_featured, published_at,
  warranty_months, weight_grams, width_mm, height_mm, length_mm,
  search_keywords, seo_title, seo_description,
  created_at, updated_at, created_by, updated_by,
  brand:brands ( id, name, slug ),
  category:categories ( id, name, slug, path ),
  images:product_images ( id, storage_path, alt_text, display_order, is_primary, width, height ),
  specifications:product_specifications ( id, spec_group, name, value, unit, display_order ),
  inventory ( quantity_on_hand, quantity_reserved, low_stock_threshold, allow_backorder )
` as const;

export type ProductListParams = {
  /** 1-based. */
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: Enums<"product_status">;
  visibility?: Enums<"product_visibility">;
  featuredOnly?: boolean;
  sort?: "updated_at" | "name" | "price_cents" | "created_at";
  direction?: "asc" | "desc";
  /** Include soft-deleted rows. Admin-only; the storefront never asks. */
  includeDeleted?: boolean;
};

export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const MAX_PAGE_SIZE = 100;

/**
 * A page of products.
 *
 * Filtering, sorting and pagination all happen **in the query**. The admin's
 * `DataTable` currently does this in memory against fixtures, which is fine for
 * twelve rows and does not survive 50,000 (**D-2**).
 *
 * `count: "exact"` is used because the admin shows a total. It is a second scan
 * and at very large offsets it is the expensive half of this query — the point
 * at which the storefront should move to keyset pagination, which is why
 * `ProductListParams` keeps `page` optional rather than baking offsets in.
 */
export async function listProducts(
  supabase: Client,
  params: ProductListParams = {},
): Promise<Paginated<ProductListRow>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? 20));
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .range(from, from + pageSize - 1)
    .order(params.sort ?? "updated_at", {
      ascending: params.direction === "asc",
    });

  if (!params.includeDeleted) query = query.is("deleted_at", null);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.brandId) query = query.eq("brand_id", params.brandId);
  if (params.status) query = query.eq("status", params.status);
  if (params.visibility) query = query.eq("visibility", params.visibility);
  if (params.featuredOnly) query = query.eq("is_featured", true);

  if (params.search?.trim()) {
    const term = params.search.trim();
    // `search_vector` is a generated, weighted tsvector with a GIN index;
    // `websearch_to_tsquery` accepts what a person actually types (quoted
    // phrases, `-excluded`) instead of requiring tsquery syntax.
    query = query.textSearch("search_vector", term, {
      type: "websearch",
      config: "simple",
    });
  }

  const { data, error, count } = await query;
  if (error) throw toAppError(error, "list products");

  return {
    rows: (data ?? []) as unknown as ProductListRow[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export type ProductListRow = Pick<
  Tables<"products">,
  | "id"
  | "slug"
  | "sku"
  | "name"
  | "short_description"
  | "price_cents"
  | "sale_price_cents"
  | "status"
  | "visibility"
  | "is_featured"
  | "published_at"
  | "updated_at"
> & {
  brand: Pick<Tables<"brands">, "id" | "name" | "slug"> | null;
  category: Pick<Tables<"categories">, "id" | "name" | "slug"> | null;
  inventory: Pick<
    Tables<"inventory">,
    "quantity_on_hand" | "quantity_reserved" | "low_stock_threshold"
  > | null;
};

/**
 * One product with everything a detail page renders.
 *
 * Images, specifications and inventory come back in the **same round trip** as
 * embedded selects rather than as four sequential queries — the N+1 this service
 * exists to prevent. PostgREST resolves them through the foreign keys, so the
 * shape is checked by the generated types.
 */
export async function getProductBySlug(
  supabase: Client,
  slug: string,
): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the product");
  if (!data) throw notFoundOrForbidden("Product");

  return data as unknown as ProductDetail;
}

export async function getProductById(
  supabase: Client,
  id: string,
): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw toAppError(error, "load the product");
  if (!data) throw notFoundOrForbidden("Product");

  return data as unknown as ProductDetail;
}

export type ProductDetail = Tables<"products"> & {
  brand: Pick<Tables<"brands">, "id" | "name" | "slug"> | null;
  category: Pick<Tables<"categories">, "id" | "name" | "slug" | "path"> | null;
  images: Tables<"product_images">[];
  specifications: Tables<"product_specifications">[];
  inventory: Tables<"inventory"> | null;
};

/**
 * Slugs for `generateStaticParams`.
 *
 * Only the column that is needed. Selecting whole rows to read one field is the
 * commonest accidental cost in a prerender step that runs for every product.
 */
export async function listPublishedSlugs(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null);

  if (error) throw toAppError(error, "list product slugs");

  return (data ?? []).map((row) => row.slug);
}

export async function createProduct(
  supabase: Client,
  input: TablesInsert<"products">,
): Promise<Tables<"products">> {
  const { data, error } = await supabase
    .from("products")
    .insert(input)
    .select()
    .single();

  if (error) throw toAppError(error, "create the product");

  return data;
}

export async function updateProduct(
  supabase: Client,
  id: string,
  patch: TablesUpdate<"products">,
): Promise<Tables<"products">> {
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the product");
  // No row came back: either it does not exist or RLS filtered it. Both read as
  // "not found" from here — see `notFoundOrForbidden`.
  if (!data) throw notFoundOrForbidden("Product");

  return data;
}

/**
 * Soft delete.
 *
 * `products.deleted_at` exists because orders reference products: a hard delete
 * would either fail on the foreign key or orphan order history. Every read in
 * this service filters `deleted_at is null`, so a soft-deleted product is
 * invisible without being destroyed.
 */
export async function softDeleteProduct(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "delete the product");
  if (count === 0) throw notFoundOrForbidden("Product");
}

export async function restoreProduct(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw toAppError(error, "restore the product");
}

/**
 * Copies a product, its specifications and its images.
 *
 * The copy is always a **draft** with a new slug and SKU: publishing a
 * duplicate immediately would put two identical products on the storefront, and
 * reusing the slug violates the unique index — a constraint error the operator
 * would have to decode.
 *
 * Not atomic. Three statements without a transaction means a failure partway
 * leaves a draft with some of its children; PostgREST cannot open one, so this
 * belongs in an RPC before it is used in anger. Recorded rather than pretended.
 */
export async function duplicateProduct(
  supabase: Client,
  id: string,
  overrides: { slug: string; sku: string },
): Promise<Tables<"products">> {
  const source = await getProductById(supabase, id);

  const copy = await createProduct(supabase, {
    slug: overrides.slug,
    sku: overrides.sku,
    name: `${source.name} (copy)`,
    description: source.description,
    short_description: source.short_description,
    price_cents: source.price_cents,
    sale_price_cents: source.sale_price_cents,
    cost_price_cents: source.cost_price_cents,
    brand_id: source.brand_id,
    category_id: source.category_id,
    status: "draft",
    visibility: source.visibility,
    is_featured: false,
    warranty_months: source.warranty_months,
    weight_grams: source.weight_grams,
    search_keywords: source.search_keywords,
    seo_title: source.seo_title,
    seo_description: source.seo_description,
  });

  if (source.specifications.length > 0) {
    const { error } = await supabase.from("product_specifications").insert(
      source.specifications.map((spec) => ({
        product_id: copy.id,
        spec_group: spec.spec_group,
        name: spec.name,
        value: spec.value,
        unit: spec.unit,
        display_order: spec.display_order,
      })),
    );

    if (error) throw toAppError(error, "copy the specifications");
  }

  if (source.images.length > 0) {
    // The storage objects are shared, not copied: two rows may point at one
    // file. Deleting an image row must therefore not delete the object unless
    // it is the last reference — see `services/storage.service.ts`.
    const { error } = await supabase.from("product_images").insert(
      source.images.map((image) => ({
        product_id: copy.id,
        storage_path: image.storage_path,
        alt_text: image.alt_text,
        display_order: image.display_order,
        is_primary: image.is_primary,
        width: image.width,
        height: image.height,
      })),
    );

    if (error) throw toAppError(error, "copy the images");
  }

  return copy;
}

/**
 * Replaces a product's specification list.
 *
 * Delete-then-insert rather than a diff: specifications have no stable identity
 * a user cares about, ordering is positional, and reconciling three lists is
 * more code than it is worth. Same caveat as `duplicateProduct` — two
 * statements, no transaction.
 */
export async function replaceSpecifications(
  supabase: Client,
  productId: string,
  specs: Omit<TablesInsert<"product_specifications">, "product_id">[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("product_specifications")
    .delete()
    .eq("product_id", productId);

  if (deleteError) throw toAppError(deleteError, "clear the specifications");

  if (specs.length === 0) return;

  const { error } = await supabase
    .from("product_specifications")
    .insert(specs.map((spec) => ({ ...spec, product_id: productId })));

  if (error) throw toAppError(error, "save the specifications");
}

/** Featured products for the home page, cheapest possible shape. */
export async function listFeatured(
  supabase: Client,
  limit = 8,
): Promise<ProductListRow[]> {
  const { rows } = await listProducts(supabase, {
    featuredOnly: true,
    status: "active",
    visibility: "public",
    pageSize: limit,
    sort: "updated_at",
  });

  return rows;
}

/** Products with a sale price below list. */
export async function listDeals(
  supabase: Client,
  limit = 8,
): Promise<ProductListRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null)
    .not("sale_price_cents", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw toAppError(error, "list deals");

  return (data ?? []) as unknown as ProductListRow[];
}

/**
 * Guards a publish transition.
 *
 * `status = 'active'` alone does not put a product on the storefront — the
 * storefront also requires `visibility = 'public'`, and a product with no price
 * or no category is a broken listing. Checking here rather than in the form
 * means the rule holds for every caller, including a future import script.
 */
export function assertPublishable(product: ProductDetail): void {
  const problems: string[] = [];

  if (!product.name.trim()) problems.push("name");
  if (product.price_cents <= 0) problems.push("price");
  if (!product.category_id) problems.push("category");
  if (!product.brand_id) problems.push("brand");

  if (problems.length > 0) {
    throw new AppError("validation", "This product is not ready to publish.", {
      details: { product: problems },
    });
  }
}
