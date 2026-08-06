import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import {
  isPublishable,
  toLocalizedText,
  toTranslationRows,
} from "@/lib/i18n/translations";
import { locales, type Locale } from "@/lib/site-config";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
import type { Database, Enums, TablesInsert } from "@/types/database";

type Client = SupabaseClient<Database>;

const COLUMNS = `
  id, parent_id, depth, path, display_order, is_visible, is_featured,
  icon, image_path, updated_at,
  translations:category_translations (
    locale, name, slug, description, seo_title, seo_description, seo_keywords,
    canonical_url, og_title, og_description, og_image_path, twitter_card
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
  /** Promoted in the storefront navigation. Zero featured is a real state. */
  isFeatured: boolean;
  /** A lucide name resolved by `CATEGORY_ICONS`, never a URL (ADR-72). */
  icon: string | null;
  imagePath: string | null;
  updatedAt: string;
  name: LocalizedText;
  slug: LocalizedText;
  description: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
  /**
   * Search terms, **not** localized. A shopper types "rtx 4090" whatever
   * language the page is in, so the same array is written to every locale's row
   * — the column is per-locale because the table is, not because the value is.
   */
  seoKeywords: string[];
  canonicalUrl: LocalizedText;
  ogTitle: LocalizedText;
  ogDescription: LocalizedText;
  ogImagePath: string | null;
  twitterCard: Enums<"twitter_card"> | null;
  isTranslationComplete: boolean;
};

/**
 * A category with its children attached.
 *
 * Built in memory from the flat list by `toCategoryTree` — **not** by a second
 * query per level, which is the N+1 a nested menu invites. Depth is unlimited:
 * the node type is recursive and the builder walks whatever `parent_id` says.
 */
export type CategoryNode = Category & { children: CategoryNode[] };

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
    isFeatured: (row.is_featured ?? false) as boolean,
    icon: (row.icon ?? null) as string | null,
    imagePath: (row.image_path ?? null) as string | null,
    updatedAt: row.updated_at as string,
    name,
    slug,
    description: toLocalizedText(translations, "description"),
    seoTitle: toLocalizedText(translations, "seo_title"),
    seoDescription: toLocalizedText(translations, "seo_description"),
    // Written identically to every locale, so reading the default locale's row
    // is reading all of them. `?? []` because a category with no translation
    // row at all is a legitimate half-created state.
    seoKeywords: (translations.find((row) => row.seo_keywords)?.seo_keywords ??
      []) as string[],
    canonicalUrl: toLocalizedText(translations, "canonical_url"),
    ogTitle: toLocalizedText(translations, "og_title"),
    ogDescription: toLocalizedText(translations, "og_description"),
    ogImagePath:
      (translations.find((row) => row.og_image_path)?.og_image_path as
        string | undefined) ?? null,
    twitterCard:
      (translations.find((row) => row.twitter_card)?.twitter_card as
        Enums<"twitter_card"> | undefined) ?? null,
    isTranslationComplete: isPublishable([name, slug]),
  };
}

/**
 * Folds the flat list into a tree, in one pass, with no further queries.
 *
 * This is the whole reason the mega menu costs one round trip: `listCategories`
 * returns every category and every translation in a single request, and the
 * nesting is arithmetic on what came back rather than a query per department.
 *
 * Two properties worth stating, because both are failure modes a menu hits in
 * production before anywhere else:
 *
 *   * **Depth is not capped.** The builder follows `parent_id` for as many
 *     levels as exist. Two is what the taxonomy ships with; nothing here knows
 *     that number.
 *   * **An orphan is promoted, never dropped.** A child whose parent is absent
 *     from the input — hidden, soft-deleted, or invisible to this caller's RLS —
 *     is attached at the root instead of vanishing. A category that silently
 *     disappears from navigation because its parent was hidden is the bug that
 *     takes a week to notice.
 *
 * Siblings keep the order the query returned them in, which is
 * `display_order` — so ordering is decided by the database and this function
 * never re-sorts.
 */
export function toCategoryTree(
  categories: readonly Category[],
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );

  const roots: CategoryNode[] = [];

  for (const category of categories) {
    const node = nodes.get(category.id);
    if (!node) continue;

    const parent = category.parentId ? nodes.get(category.parentId) : undefined;

    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/**
 * Every category, ordered for display, with all three languages.
 *
 * The whole tree plus its copy in **one query** — the embedded translation rows
 * avoid the per-category lookup a menu would otherwise do on every page load,
 * and `toCategoryTree` nests the result without a recursive CTE.
 *
 * ## The ordering is `(depth, display_order)`, and it used to be `(path, …)`
 *
 * `path` is a `uuid[]`, so ordering by it sorts by **random identifiers**. That
 * was invisible while the taxonomy was a flat list nobody had arranged; the
 * moment the twelve departments had a business order, the header rendered them
 * shuffled — Storage first, Computer builds seventh. Caught by reading the
 * rendered menu, not by reasoning about the query.
 *
 * `depth` ascending does the one job `path` was actually needed for: a parent is
 * always returned before its children, which is what lets the tree fold and the
 * admin's descendant walk work in a single pass. `display_order` then gives the
 * sequence inside each sibling group, which is the only ordering an operator
 * ever sets.
 */
export async function listCategories(
  supabase: Client,
  options: { visibleOnly?: boolean } = {},
): Promise<Category[]> {
  let query = supabase
    .from("categories")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("depth", { ascending: true })
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

/**
 * Rolls direct product counts up the tree.
 *
 * A department with no products of its own but forty across its subcategories
 * has forty products as far as a shopper is concerned, and printing `0` beside
 * "Components" is wrong in the way that makes somebody not click it.
 *
 * Walks each category's materialised `path`, which is the root-to-self chain the
 * trigger maintains (ADR-26) — so this is one pass over the list rather than a
 * recursive descent, and it is correct at any depth.
 */
export function rollUpProductCounts(
  categories: readonly Category[],
  direct: ReadonlyMap<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const category of categories) {
    const own = direct.get(category.id) ?? 0;
    if (own === 0) continue;

    // `path` includes the category itself, so this credits the row and every
    // ancestor above it in one loop.
    for (const ancestorId of category.path) {
      totals.set(ancestorId, (totals.get(ancestorId) ?? 0) + own);
    }
  }

  // A category with no products anywhere still needs an entry, or the caller
  // cannot tell "none" from "not counted".
  for (const category of categories) {
    if (!totals.has(category.id)) totals.set(category.id, 0);
  }

  return totals;
}

export type CategoryInput = {
  parentId: string | null;
  displayOrder?: number;
  isVisible?: boolean;
  isFeatured?: boolean;
  icon?: string | null;
  imagePath?: string | null;
  name: LocalizedText;
  slug: LocalizedText;
  description?: LocalizedText;
  seoTitle?: LocalizedText;
  seoDescription?: LocalizedText;
  seoKeywords?: readonly string[];
  canonicalUrl?: LocalizedText;
  ogTitle?: LocalizedText;
  ogDescription?: LocalizedText;
  /** One value for every locale — see the note in `ModuleSeoPanel`. */
  ogImagePath?: string | null;
  twitterCard?: Enums<"twitter_card"> | null;
};

/** One value, stored on every locale's row. */
function sameInEveryLocale(value: string): LocalizedText {
  return Object.fromEntries(
    locales.map((locale) => [locale, value]),
  ) as LocalizedText;
}

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
      seo_keywords: input.seoKeywords,
      canonical_url: input.canonicalUrl,
      og_title: input.ogTitle,
      og_description: input.ogDescription,
      // Scalars the panel writes once and stores per locale. Expanded into a
      // `LocalizedText` here rather than in the caller, so every caller — a
      // form, a script, an import — gets the same behaviour.
      og_image_path: input.ogImagePath
        ? sameInEveryLocale(input.ogImagePath)
        : undefined,
      twitter_card: input.twitterCard
        ? sameInEveryLocale(input.twitterCard)
        : undefined,
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
      is_featured: input.isFeatured ?? false,
      icon: input.icon ?? null,
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
      is_featured: input.isFeatured ?? false,
      icon: input.icon ?? null,
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
 * Persists a new arrangement: position within a sibling group, and optionally a
 * new parent.
 *
 * Drag-and-drop in a tree moves two things at once — where a row sits and what
 * it sits under — and splitting that into "reorder" plus a separate "save the
 * parent" is how a drop leaves the two disagreeing when the second call fails.
 * So one call carries both, and a caller that only reorders simply omits
 * `parentId`.
 *
 * **Re-parenting is not validated here.** A cycle is rejected by the trigger,
 * which is the only thing that sees the whole tree atomically, and the same
 * trigger rewrites the `path` of every descendant of a moved branch (ADR-26).
 * `toAppError` turns that raise into a sentence rather than leaking the
 * trigger's text.
 *
 * One update per row, concurrently. An upsert would be a single round trip, but
 * PostgREST's upsert is `insert … on conflict` and needs every non-defaulted
 * column, so a partial upsert would insert a category with no parent if an id
 * were ever wrong. Not atomic: a partial failure leaves a mixed order, which is
 * visually wrong rather than destructive and is fixed by saving again.
 */
export async function reorderCategories(
  supabase: Client,
  order: {
    id: string;
    displayOrder: number;
    /** Omit to leave the parent alone; `null` moves the row to the top level. */
    parentId?: string | null;
  }[],
): Promise<void> {
  if (order.length === 0) return;

  const results = await Promise.all(
    order.map(({ id, displayOrder, parentId }) =>
      supabase
        .from("categories")
        .update({
          display_order: displayOrder,
          ...(parentId === undefined ? {} : { parent_id: parentId }),
        })
        .eq("id", id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) throw toAppError(failed.error, "save the category order");
}

/**
 * Shows or hides a category without touching anything else on it.
 *
 * A dedicated call rather than a full save, because the list wants a one-click
 * toggle and routing that through `updateCategory` would mean the list holding —
 * and re-sending — every translated field just to flip a boolean. That is how a
 * half-loaded row overwrites good copy with blanks.
 *
 * Hiding is **not** propagated to descendants. The storefront tree builder
 * decides what a hidden parent means for its children (they are promoted, never
 * dropped), and writing the flag down the subtree would make unhiding a
 * department silently re-publish subcategories an operator had hidden
 * deliberately.
 */
export async function setCategoryVisibility(
  supabase: Client,
  id: string,
  isVisible: boolean,
): Promise<void> {
  const { error, count } = await supabase
    .from("categories")
    .update({ is_visible: isVisible }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "change the category visibility");
  if (count === 0) throw notFoundOrForbidden("Category");
}

/**
 * Soft delete.
 *
 * Products reference categories with `on delete restrict`, so a hard delete
 * would be refused outright. Translations are left intact — they cascade only
 * when the row itself is removed.
 *
 * **A category with live children is refused.** Soft-deleting a parent leaves
 * its subcategories pointing at a row the storefront no longer renders, and the
 * tree builder would promote all fifteen of them to the top level — an operator
 * who deleted "Components" would watch the header fill with processors and
 * motherboards. Cascading the delete is the other wrong answer: it removes rows
 * nobody asked to remove. So the operator is told to move or delete the children
 * first, which is the only version of this they can undo.
 */
export async function softDeleteCategory(
  supabase: Client,
  id: string,
): Promise<void> {
  const { count: childCount, error: childError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id)
    .is("deleted_at", null);

  if (childError) throw toAppError(childError, "delete the category");

  if ((childCount ?? 0) > 0) {
    throw new AppError(
      "conflict",
      "Move or remove the subcategories before deleting this category.",
    );
  }

  const { error, count } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "delete the category");
  if (count === 0) throw notFoundOrForbidden("Category");
}
