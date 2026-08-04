import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import {
  isPublishable,
  toLocalizedText,
  toTranslationRows,
} from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
import type { Database, TablesInsert } from "@/types/database";

type Client = SupabaseClient<Database>;

const COLUMNS = `
  id, parent_id, depth, path, display_order, is_visible, image_path, updated_at,
  translations:category_translations (
    locale, name, slug, description, seo_title, seo_description
  )
` as const;

/** What the UI receives — translations already folded (K-15). */
export type Category = {
  id: string;
  parentId: string | null;
  depth: number;
  path: string[];
  displayOrder: number;
  isVisible: boolean;
  imagePath: string | null;
  updatedAt: string;
  name: LocalizedText;
  slug: LocalizedText;
  description: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  isTranslationComplete: boolean;
};

type RawTranslation = { locale: Locale } & Record<string, unknown>;

function fold(row: Record<string, unknown>): Category {
  const translations = (row.translations ?? []) as RawTranslation[];
  const name = toLocalizedText(translations, "name");
  const slug = toLocalizedText(translations, "slug");

  return {
    id: row.id as string,
    parentId: (row.parent_id ?? null) as string | null,
    depth: row.depth as number,
    path: (row.path ?? []) as string[],
    displayOrder: row.display_order as number,
    isVisible: row.is_visible as boolean,
    imagePath: (row.image_path ?? null) as string | null,
    updatedAt: row.updated_at as string,
    name,
    slug,
    description: toLocalizedText(translations, "description"),
    seoTitle: toLocalizedText(translations, "seo_title"),
    seoDescription: toLocalizedText(translations, "seo_description"),
    isTranslationComplete: isPublishable([name, slug]),
  };
}

/**
 * Every category, ordered for display, with all three languages.
 *
 * The whole tree plus its copy in **one query**. `categories.path` is a
 * materialised ancestor array maintained by a trigger, so depth and ordering
 * come back without a recursive CTE, and the embedded translation rows avoid
 * the per-category lookup a menu would otherwise do on every page load.
 */
export async function listCategories(
  supabase: Client,
  options: { visibleOnly?: boolean } = {},
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("path", { ascending: true })
    .order("display_order", { ascending: true });

  if (options.visibleOnly) query = query.eq("is_visible", true);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list categories");

  return (data ?? []).map((row) => fold(row as Record<string, unknown>));
}

/** By localized slug — `(locale, slug)`, because the slug is per-language now. */
export async function getCategoryBySlug(
  supabase: Client,
  locale: Locale,
  slug: string,
): Promise<Category> {
  const { data: match, error: lookupError } = await supabase
    .from("category_translations")
    .select("category_id")
    .eq("locale", locale)
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) throw toAppError(lookupError, "find the category");
  if (!match) throw notFoundOrForbidden("Category");

  const { data, error } = await supabase
    .from("categories")
    .select(COLUMNS)
    .eq("id", match.category_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the category");
  if (!data) throw notFoundOrForbidden("Category");

  return fold(data as unknown as Record<string, unknown>);
}

/**
 * Product counts per category, in one query.
 *
 * Counting per category by looping the list is the classic N+1: forty
 * categories become forty round trips. PostgREST cannot `group by`, so this
 * fetches the category id of every visible product once and tallies in memory —
 * correct up to the catalog size where a view or an RPC becomes the answer.
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

export type CategoryInput = {
  parentId: string | null;
  displayOrder?: number;
  isVisible?: boolean;
  imagePath?: string | null;
  name: LocalizedText;
  slug: LocalizedText;
  description?: LocalizedText;
  seoTitle?: LocalizedText;
  seoDescription?: LocalizedText;
};

async function saveTranslations(
  supabase: Client,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  const rows = toTranslationRows(
    { category_id: categoryId },
    {
      name: input.name,
      slug: input.slug,
      description: input.description,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
    },
  );

  if (rows.length === 0) {
    throw new AppError(
      "validation",
      "A category needs a name in at least one language.",
    );
  }

  const { error } = await supabase
    .from("category_translations")
    .upsert(rows as TablesInsert<"category_translations">[], {
      onConflict: "category_id,locale",
    });

  if (error) throw toAppError(error, "save the category translations");
}

export async function createCategory(
  supabase: Client,
  input: CategoryInput,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      parent_id: input.parentId,
      display_order: input.displayOrder ?? 0,
      is_visible: input.isVisible ?? true,
      image_path: input.imagePath ?? null,
    })
    .select("id")
    .single();

  if (error) throw toAppError(error, "create the category");

  try {
    await saveTranslations(supabase, data.id, input);
  } catch (cause) {
    await supabase.from("categories").delete().eq("id", data.id);
    throw cause;
  }

  return getCategoryById(supabase, data.id);
}

export async function getCategoryById(
  supabase: Client,
  id: string,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw toAppError(error, "load the category");
  if (!data) throw notFoundOrForbidden("Category");

  return fold(data as unknown as Record<string, unknown>);
}

/**
 * Updates a category.
 *
 * Re-parenting is allowed and deliberately **not** validated here: the schema
 * rejects a cycle with a trigger, which is the only place that sees the whole
 * tree atomically. `toAppError` turns that raise into a message rather than
 * leaking the trigger's text.
 */
export async function updateCategory(
  supabase: Client,
  id: string,
  input: CategoryInput,
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update({
      parent_id: input.parentId,
      display_order: input.displayOrder ?? 0,
      is_visible: input.isVisible ?? true,
      image_path: input.imagePath ?? null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw toAppError(error, "update the category");
  if (!data) throw notFoundOrForbidden("Category");

  await saveTranslations(supabase, id, input);

  return getCategoryById(supabase, id);
}

/**
 * Persists a new display order.
 *
 * One update per row, concurrently. An upsert would be a single round trip, but
 * PostgREST's upsert is `insert … on conflict` and needs every non-defaulted
 * column, so a partial upsert would insert a category with no parent if an id
 * were ever wrong. Not atomic: a partial failure leaves a mixed order, which is
 * visually wrong rather than destructive and is fixed by saving again.
 */
export async function reorderCategories(
  supabase: Client,
  order: { id: string; displayOrder: number }[],
): Promise<void> {
  if (order.length === 0) return;

  const results = await Promise.all(
    order.map(({ id, displayOrder }) =>
      supabase
        .from("categories")
        .update({ display_order: displayOrder })
        .eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw toAppError(failed.error, "save the category order");
}

/**
 * Soft delete.
 *
 * Products reference categories with `on delete set null`, so a hard delete
 * would silently uncategorise every product under it. Translations are left
 * intact — they cascade only when the row itself is removed.
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
