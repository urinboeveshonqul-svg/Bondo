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
  id, slug, name, description, parent_id, depth, path, display_order,
  is_visible, image_path, seo_title, seo_description, updated_at
` as const;

export type CategoryRow = Pick<
  Tables<"categories">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "parent_id"
  | "depth"
  | "path"
  | "display_order"
  | "is_visible"
  | "image_path"
  | "seo_title"
  | "seo_description"
  | "updated_at"
>;

/**
 * Every category, ordered for display.
 *
 * The whole tree in **one query**. `categories.path` is a materialised ancestor
 * array maintained by a trigger, so depth and ordering come back without a
 * recursive CTE and without the client walking parents — which is the N+1 a
 * category menu otherwise causes on every page load.
 */
export async function listCategories(
  supabase: Client,
  options: { visibleOnly?: boolean } = {},
): Promise<CategoryRow[]> {
  let query = supabase
    .from("categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    // `path` first so children sort under their parent, then explicit order.
    .order("path", { ascending: true })
    .order("display_order", { ascending: true });

  if (options.visibleOnly) query = query.eq("is_visible", true);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list categories");

  return data ?? [];
}

export async function getCategoryBySlug(
  supabase: Client,
  slug: string,
): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from("categories")
    .select(COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the category");
  if (!data) throw notFoundOrForbidden("Category");

  return data;
}

/**
 * Product counts per category, in one grouped query.
 *
 * Counting per category by looping the list is the classic N+1: forty
 * categories become forty round trips. PostgREST cannot `group by`, so this
 * fetches the category id of every visible product once and tallies in memory —
 * correct up to catalog sizes where a `category_product_counts` view or an RPC
 * becomes the right answer instead.
 */
export async function countProductsByCategory(
  supabase: Client,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("category_id")
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null);

  if (error) throw toAppError(error, "count products by category");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return counts;
}

export async function createCategory(
  supabase: Client,
  input: TablesInsert<"categories">,
): Promise<Tables<"categories">> {
  const { data, error } = await supabase
    .from("categories")
    .insert(input)
    .select()
    .single();

  if (error) throw toAppError(error, "create the category");

  return data;
}

/**
 * Updates a category.
 *
 * Re-parenting is allowed and deliberately **not** validated here: the schema
 * rejects a cycle with a trigger, which is the only place that can see the whole
 * tree atomically. `toAppError` maps that raise to a `forbidden`/`validation`
 * message rather than leaking the trigger's text.
 */
export async function updateCategory(
  supabase: Client,
  id: string,
  patch: TablesUpdate<"categories">,
): Promise<Tables<"categories">> {
  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the category");
  if (!data) throw notFoundOrForbidden("Category");

  return data;
}

/**
 * Persists a new display order.
 *
 * One update per row, issued concurrently. An `upsert` would be a single round
 * trip, but PostgREST's upsert is an `insert … on conflict` and therefore needs
 * every non-defaulted column — `slug` and `name` here — so passing only
 * `{ id, display_order }` inserts a category with a null name if the id is ever
 * wrong. That is a worse failure than N requests for a list of this size.
 *
 * Not atomic: a partial failure leaves a mixed order. Visually wrong, not
 * destructive, and re-saving fixes it. A `reorder_categories(jsonb)` RPC is the
 * answer when the list outgrows this.
 */
export async function reorderCategories(
  supabase: Client,
  order: { id: string; display_order: number }[],
): Promise<void> {
  if (order.length === 0) return;

  const results = await Promise.all(
    order.map(({ id, display_order }) =>
      supabase.from("categories").update({ display_order }).eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw toAppError(failed.error, "save the category order");
}

/**
 * Soft delete.
 *
 * Products reference categories with `on delete set null`, so a hard delete
 * would silently uncategorise every product under it. Soft deleting keeps the
 * row addressable while removing it from every read in this service.
 */
export async function softDeleteCategory(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "delete the category");
  if (count === 0) throw notFoundOrForbidden("Category");
}
