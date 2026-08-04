import type { SupabaseClient } from "@supabase/supabase-js";

import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/database";

type Client = SupabaseClient<Database>;

const COLUMNS = `
  id, slug, name, description, logo_path, website_url,
  is_featured, is_visible, seo_title, seo_description, updated_at
` as const;

export type BrandRow = Pick<
  Tables<"brands">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "logo_path"
  | "website_url"
  | "is_featured"
  | "is_visible"
  | "seo_title"
  | "seo_description"
  | "updated_at"
>;

export async function listBrands(
  supabase: Client,
  options: { visibleOnly?: boolean; featuredOnly?: boolean } = {},
): Promise<BrandRow[]> {
  let query = supabase
    .from("brands")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (options.visibleOnly) query = query.eq("is_visible", true);
  if (options.featuredOnly) query = query.eq("is_featured", true);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list brands");

  return data ?? [];
}

export async function getBrandBySlug(
  supabase: Client,
  slug: string,
): Promise<BrandRow> {
  const { data, error } = await supabase
    .from("brands")
    .select(COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the brand");
  if (!data) throw notFoundOrForbidden("Brand");

  return data;
}

export async function createBrand(
  supabase: Client,
  input: TablesInsert<"brands">,
): Promise<Tables<"brands">> {
  const { data, error } = await supabase
    .from("brands")
    .insert(input)
    .select()
    .single();

  if (error) throw toAppError(error, "create the brand");

  return data;
}

export async function updateBrand(
  supabase: Client,
  id: string,
  patch: TablesUpdate<"brands">,
): Promise<Tables<"brands">> {
  const { data, error } = await supabase
    .from("brands")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the brand");
  if (!data) throw notFoundOrForbidden("Brand");

  return data;
}

/**
 * Soft delete.
 *
 * `products.brand_id` is `on delete set null`, so a hard delete would strip the
 * brand from every product that had it, irreversibly and without warning.
 */
export async function softDeleteBrand(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("brands")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "delete the brand");
  if (count === 0) throw notFoundOrForbidden("Brand");
}

/** Product counts per brand — see the note in `countProductsByCategory`. */
export async function countProductsByBrand(
  supabase: Client,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("brand_id")
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null);

  if (error) throw toAppError(error, "count products by brand");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.brand_id) continue;
    counts.set(row.brand_id, (counts.get(row.brand_id) ?? 0) + 1);
  }

  return counts;
}
