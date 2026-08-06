import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import {
  isPublishable,
  pick,
  toLocalizedText,
  toTranslationRows,
} from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
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
 * **Translations are this layer's job** (K-15). Callers pass and receive
 * `LocalizedText`; `product_translations` never appears in a page, a component
 * or a type the UI imports. Reads embed the translation rows and fold them;
 * writes upsert them. That is the whole of "the UI should never know how
 * translations are stored".
 *
 * **Selects are explicit, never `*`.** A `*` re-shapes silently when a column
 * is added and ships `search_vector` — a `tsvector` nobody renders — on every
 * row of every listing.
 */

type Client = SupabaseClient<Database>;

/** Language-independent columns plus the embedded translation set. */
const LIST_COLUMNS = `
  id, sku, price_cents, sale_price_cents,
  status, visibility, is_featured, published_at, updated_at,
  brand:brands ( id, slug, name ),
  category:categories ( id ),
  inventory ( quantity_on_hand, quantity_reserved, low_stock_threshold ),
  translations:product_translations ( locale, name, slug, short_description )
` as const;

const DETAIL_COLUMNS = `
  id, sku, price_cents, sale_price_cents, cost_price_cents,
  status, visibility, is_featured, published_at,
  warranty_months, weight_grams, width_mm, height_mm, length_mm,
  created_at, updated_at, created_by, updated_by,
  brand:brands ( id, slug, name ),
  category:categories ( id, path ),
  images:product_images ( id, storage_path, alt_text, display_order, is_primary, width, height ),
  specifications:product_specifications ( id, spec_group, name, value, unit, display_order ),
  inventory ( quantity_on_hand, quantity_reserved, low_stock_threshold, allow_backorder ),
  translations:product_translations (
    locale, name, slug, short_description, description,
    seo_title, seo_description, seo_keywords
  )
` as const;

/** What the UI receives. No translation rows, no locale plumbing. */
export type ProductListItem = {
  id: string;
  sku: string;
  name: LocalizedText;
  slug: LocalizedText;
  shortDescription: LocalizedText;
  priceCents: number;
  salePriceCents: number | null;
  status: Enums<"product_status">;
  visibility: Enums<"product_visibility">;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  brand: { id: string; slug: string; name: string } | null;
  categoryId: string | null;
  stockOnHand: number;
  /** False when any supported language is missing copy — see `isPublishable`. */
  isTranslationComplete: boolean;
};

export type ProductDetail = ProductListItem & {
  description: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  seoKeywords: readonly string[];
  costPriceCents: number | null;
  warrantyMonths: number | null;
  weightGrams: number | null;
  images: Tables<"product_images">[];
  specifications: Tables<"product_specifications">[];
  inventory: Tables<"inventory"> | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Which language the search term is in. Decides the dictionary. */
  locale?: Locale;
  categoryId?: string;
  /**
   * Every category in the requested subtree, ancestor included.
   *
   * Set instead of `categoryId` when a shopper picks a **department**: products
   * are filed against a leaf, so `category_id = <Components>` matches nothing
   * while every graphics card sits one level below it. The caller resolves the
   * subtree from the tree it already has, rather than this issuing a second
   * query per listing.
   */
  categoryIds?: readonly string[];
  brandId?: string;
  status?: Enums<"product_status">;
  visibility?: Enums<"product_visibility">;
  featuredOnly?: boolean;
  sort?: "updated_at" | "price_cents" | "created_at";
  direction?: "asc" | "desc";
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

type RawTranslation = { locale: Locale } & Record<string, unknown>;

function foldList(row: Record<string, unknown>): ProductListItem {
  const translations = (row.translations ?? []) as RawTranslation[];
  const inventory = row.inventory as { quantity_on_hand?: number } | null;

  const name = toLocalizedText(translations, "name");
  const slug = toLocalizedText(translations, "slug");
  const shortDescription = toLocalizedText(translations, "short_description");

  return {
    id: row.id as string,
    sku: row.sku as string,
    name,
    slug,
    shortDescription,
    priceCents: row.price_cents as number,
    salePriceCents: (row.sale_price_cents ?? null) as number | null,
    status: row.status as Enums<"product_status">,
    visibility: row.visibility as Enums<"product_visibility">,
    isFeatured: row.is_featured as boolean,
    publishedAt: (row.published_at ?? null) as string | null,
    updatedAt: row.updated_at as string,
    brand: (row.brand ?? null) as ProductListItem["brand"],
    categoryId: ((row.category as { id?: string } | null)?.id ?? null) as
      string | null,
    stockOnHand: inventory?.quantity_on_hand ?? 0,
    isTranslationComplete: isPublishable([name, shortDescription]),
  };
}

function foldDetail(row: Record<string, unknown>): ProductDetail {
  const translations = (row.translations ?? []) as RawTranslation[];
  const base = foldList(row);

  // Keywords are search terms, not prose — identical across locales, so the
  // first row that carries them is authoritative.
  const keywords =
    (translations.find((t) => Array.isArray(t.seo_keywords))?.seo_keywords as
      string[] | undefined) ?? [];

  return {
    ...base,
    description: toLocalizedText(translations, "description"),
    seoTitle: toLocalizedText(translations, "seo_title"),
    seoDescription: toLocalizedText(translations, "seo_description"),
    seoKeywords: keywords,
    costPriceCents: (row.cost_price_cents ?? null) as number | null,
    warrantyMonths: (row.warranty_months ?? null) as number | null,
    weightGrams: (row.weight_grams ?? null) as number | null,
    images: (row.images ?? []) as Tables<"product_images">[],
    specifications: (row.specifications ??
      []) as Tables<"product_specifications">[],
    inventory: (row.inventory ?? null) as Tables<"inventory"> | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * A page of products.
 *
 * Filtering, sorting and pagination happen **in the query**. Sorting by name is
 * deliberately absent: the name now lives on a joined row, so ordering by it
 * means ordering by a column PostgREST cannot reach from the parent. The admin
 * sorts by `updated_at` or price; a name sort wants a view or an RPC, and
 * pretending otherwise would produce a control that silently does nothing.
 */
export async function listProducts(
  supabase: Client,
  params: ProductListParams = {},
): Promise<Paginated<ProductListItem>> {
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
  // `categoryIds` wins when both are given: it is the more specific request,
  // and a caller that sent both meant the subtree.
  if (params.categoryIds?.length) {
    query = query.in("category_id", [...params.categoryIds]);
  } else if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.brandId) query = query.eq("brand_id", params.brandId);
  if (params.status) query = query.eq("status", params.status);
  if (params.visibility) query = query.eq("visibility", params.visibility);
  if (params.featuredOnly) query = query.eq("is_featured", true);

  if (params.search?.trim()) {
    // Search runs against the translation row for the *reader's* locale, using
    // that locale's dictionary — a Russian term matched against an English
    // vector returns nothing, which is the bug per-locale vectors fix (K-15).
    const locale = params.locale ?? "uz";
    query = query
      .eq("product_translations.locale", locale)
      .textSearch("product_translations.search_vector", params.search.trim(), {
        type: "websearch",
        config:
          locale === "ru" ? "russian" : locale === "en" ? "english" : "simple",
      });
  }

  const { data, error, count } = await query;
  if (error) throw toAppError(error, "list products");

  return {
    rows: (data ?? []).map((row) => foldList(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

/**
 * One product by its **localized** slug.
 *
 * The slug is per-locale now, so the lookup is `(locale, slug)` — which is what
 * makes `/ru/products/videokarta-rtx-4090` addressable. Both halves are needed:
 * a slug alone is no longer unique across the catalog.
 */
export async function getProductBySlug(
  supabase: Client,
  locale: Locale,
  slug: string,
): Promise<ProductDetail> {
  const { data: match, error: lookupError } = await supabase
    .from("product_translations")
    .select("product_id")
    .eq("locale", locale)
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) throw toAppError(lookupError, "find the product");
  if (!match) throw notFoundOrForbidden("Product");

  return getProductById(supabase, match.product_id);
}

export async function getProductById(
  supabase: Client,
  id: string,
): Promise<ProductDetail> {
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the product");
  if (!data) throw notFoundOrForbidden("Product");

  return foldDetail(data as unknown as Record<string, unknown>);
}

/**
 * Every published slug, per locale, for `generateStaticParams`.
 *
 * Returns `(locale, slug)` pairs because the route is now localized — one
 * product prerenders under a different address in each language.
 */
export async function listPublishedSlugs(
  supabase: Client,
): Promise<{ locale: Locale; slug: string }[]> {
  const { data, error } = await supabase
    .from("product_translations")
    .select("locale, slug, products!inner ( status, visibility, deleted_at )")
    .not("slug", "is", null)
    .eq("products.status", "active")
    .eq("products.visibility", "public")
    .is("products.deleted_at", null);

  if (error) throw toAppError(error, "list product slugs");

  return (data ?? [])
    .filter((row) => row.slug)
    .map((row) => ({ locale: row.locale, slug: row.slug as string }));
}

/** Everything a product write carries, in the shape the UI already holds. */
export type ProductInput = {
  sku: string;
  name: LocalizedText;
  slug: LocalizedText;
  shortDescription: LocalizedText;
  description: LocalizedText;
  seoTitle?: LocalizedText;
  seoDescription?: LocalizedText;
  seoKeywords?: readonly string[];
  brandId: string | null;
  categoryId: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  costPriceCents?: number | null;
  status: Enums<"product_status">;
  visibility: Enums<"product_visibility">;
  isFeatured?: boolean;
  warrantyMonths?: number | null;
  weightGrams?: number | null;
};

function parentColumns(input: ProductInput): TablesInsert<"products"> {
  return {
    sku: input.sku,
    brand_id: input.brandId,
    category_id: input.categoryId,
    price_cents: input.priceCents,
    sale_price_cents: input.salePriceCents ?? null,
    cost_price_cents: input.costPriceCents ?? null,
    status: input.status,
    visibility: input.visibility,
    is_featured: input.isFeatured ?? false,
    warranty_months: input.warrantyMonths ?? null,
    weight_grams: input.weightGrams ?? null,
    // The schema refuses an active product with no publish date, so the service
    // supplies one rather than letting the constraint surface as a 500.
    published_at: input.status === "active" ? new Date().toISOString() : null,
  };
}

/**
 * Writes the translation rows for a product.
 *
 * `upsert` on the composite key, so saving is idempotent and editing one
 * language never disturbs another. Locales with no content are not written at
 * all — see `toTranslationRows`.
 */
async function saveTranslations(
  supabase: Client,
  productId: string,
  input: ProductInput,
): Promise<void> {
  const rows = toTranslationRows(
    { product_id: productId },
    {
      name: input.name,
      slug: input.slug,
      short_description: input.shortDescription,
      description: input.description,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      seo_keywords: input.seoKeywords ?? [],
    },
  );

  if (rows.length === 0) {
    throw new AppError(
      "validation",
      "A product needs a name in at least one language.",
    );
  }

  const { error } = await supabase
    .from("product_translations")
    .upsert(rows as TablesInsert<"product_translations">[], {
      onConflict: "product_id,locale",
    });

  if (error) throw toAppError(error, "save the product translations");
}

/**
 * Creates a product and its translations.
 *
 * Two statements without a transaction — PostgREST cannot open one — so a
 * failure on the second leaves a product with no copy. It is caught and the
 * parent is removed, which is the closest thing to atomicity available here and
 * is why an RPC is the right home for this before it carries real traffic.
 */
export async function createProduct(
  supabase: Client,
  input: ProductInput,
): Promise<ProductDetail> {
  assertPublishable(input);

  const { data, error } = await supabase
    .from("products")
    .insert(parentColumns(input))
    .select("id")
    .single();

  if (error) throw toAppError(error, "create the product");

  try {
    await saveTranslations(supabase, data.id, input);
  } catch (cause) {
    await supabase.from("products").delete().eq("id", data.id);
    throw cause;
  }

  return getProductById(supabase, data.id);
}

export async function updateProduct(
  supabase: Client,
  id: string,
  input: ProductInput,
): Promise<ProductDetail> {
  assertPublishable(input);

  const patch: TablesUpdate<"products"> = parentColumns(input);

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw toAppError(error, "update the product");
  // No row: it does not exist, or RLS filtered it. Indistinguishable from here.
  if (!data) throw notFoundOrForbidden("Product");

  await saveTranslations(supabase, id, input);

  return getProductById(supabase, id);
}

/**
 * Soft delete.
 *
 * `deleted_at` exists because orders reference products: a hard delete would
 * fail on the foreign key or orphan order history. Translations cascade, so
 * they are deliberately *not* touched — a soft-deleted product keeps its copy
 * and can be restored intact.
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
 * Copies a product, its translations, specifications and images.
 *
 * The copy is a **draft** with new slugs and SKU: publishing a duplicate
 * immediately would put two identical products on the storefront, and reusing a
 * slug violates the per-locale unique index — a constraint error the operator
 * would have to decode.
 */
export async function duplicateProduct(
  supabase: Client,
  id: string,
  overrides: { sku: string; slugSuffix: string },
): Promise<ProductDetail> {
  const source = await getProductById(supabase, id);

  const suffixed = (text: LocalizedText): LocalizedText =>
    Object.fromEntries(
      Object.entries(text).map(([locale, value]) => [
        locale,
        value ? `${value}-${overrides.slugSuffix}` : "",
      ]),
    ) as LocalizedText;

  const copy = await createProduct(supabase, {
    sku: overrides.sku,
    name: source.name,
    slug: suffixed(source.slug),
    shortDescription: source.shortDescription,
    description: source.description,
    seoTitle: source.seoTitle,
    seoDescription: source.seoDescription,
    seoKeywords: source.seoKeywords,
    brandId: source.brand?.id ?? null,
    categoryId: source.categoryId,
    priceCents: source.priceCents,
    salePriceCents: source.salePriceCents,
    costPriceCents: source.costPriceCents,
    status: "draft",
    visibility: source.visibility,
    isFeatured: false,
    warrantyMonths: source.warrantyMonths,
    weightGrams: source.weightGrams,
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
    // Storage objects are shared, not copied: two rows may point at one file,
    // which is why deleting an image checks for other references first.
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

  return getProductById(supabase, copy.id);
}

/** Replaces a product's specification list. */
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

export async function listFeatured(
  supabase: Client,
  limit = 8,
): Promise<ProductListItem[]> {
  const { rows } = await listProducts(supabase, {
    featuredOnly: true,
    status: "active",
    visibility: "public",
    pageSize: limit,
  });

  return rows;
}

export async function listDeals(
  supabase: Client,
  limit = 8,
): Promise<ProductListItem[]> {
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

  return (data ?? []).map((row) => foldList(row as Record<string, unknown>));
}

/**
 * Guards a publish transition.
 *
 * `status = 'active'` alone does not put a product on the storefront, and a
 * product live in one language only is the failure the translation
 * architecture exists to prevent — so **every supported language must have a
 * name and a short description** before it can go active. Enforced here rather
 * than in the form, so it holds for an import script too.
 */
export function assertPublishable(input: ProductInput): void {
  const problems: string[] = [];

  if (input.priceCents <= 0) problems.push("price");
  if (!input.categoryId) problems.push("category");
  if (!input.brandId) problems.push("brand");

  if (
    input.status === "active" &&
    !isPublishable([input.name, input.shortDescription, input.slug])
  ) {
    problems.push("translations");
  }

  if (problems.length > 0) {
    throw new AppError("validation", "This product is not ready to publish.", {
      details: { product: problems },
    });
  }
}

/** Convenience for callers rendering a single locale. */
export function localizedName(
  product: Pick<ProductListItem, "name">,
  locale: Locale,
): string {
  return pick(product.name, locale);
}
