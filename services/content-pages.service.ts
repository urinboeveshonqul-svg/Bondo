import type { SupabaseClient } from "@supabase/supabase-js";

import { toLocalizedText } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Static business-information pages — delivery, warranty, returns, contact,
 * about.
 *
 * `content_pages.key` is the stable identifier the route branches on; the copy
 * is per locale on `content_page_translations`, exactly like categories and
 * products (ADR-51). The localized `slug` column is deliberately unused: these
 * pages live at one fixed path per key in every language, so there is no second
 * address for the application to choose between.
 */

const COLUMNS = `
  id, key, is_published, display_order, updated_at,
  translations:content_page_translations (
    locale, title, excerpt, body, seo_title, seo_description
  )
` as const;

export type ContentPage = {
  id: string;
  key: string;
  isPublished: boolean;
  displayOrder: number;
  updatedAt: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
};

type RawTranslation = { locale: Locale } & Record<string, unknown>;

function fold(row: Record<string, unknown>): ContentPage {
  const translations = (row.translations ?? []) as RawTranslation[];

  return {
    id: row.id as string,
    key: row.key as string,
    isPublished: row.is_published as boolean,
    displayOrder: row.display_order as number,
    updatedAt: row.updated_at as string,
    title: toLocalizedText(translations, "title"),
    excerpt: toLocalizedText(translations, "excerpt"),
    body: toLocalizedText(translations, "body"),
    seoTitle: toLocalizedText(translations, "seo_title"),
    seoDescription: toLocalizedText(translations, "seo_description"),
  };
}

/**
 * One page by its key, with all three languages.
 *
 * **Published only.** An unpublished page is not readable by an anonymous
 * visitor at all — the RLS policy sees to that — so filtering here is legibility
 * rather than the control (ADR-4). It matters for the signed-in staff case,
 * where the policy *would* return a draft: a route that rendered it would put
 * unfinished copy on a public URL for whoever happened to be logged in.
 */
export async function getContentPage(
  supabase: Client,
  key: string,
): Promise<ContentPage> {
  const { data, error } = await supabase
    .from("content_pages")
    .select(COLUMNS)
    .eq("key", key)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the page");
  if (!data) throw notFoundOrForbidden("Page");

  return fold(data as unknown as Record<string, unknown>);
}

/**
 * Every page an editor may manage, published or not.
 *
 * The admin list needs the drafts — they are the ones that need work. The
 * separate function rather than a flag on `listContentPages` is deliberate:
 * a storefront caller that accidentally passed `includeDrafts: true` would put
 * unfinished copy on a public URL, and a parameter is easier to pass by
 * accident than an import is (ADR-4 still refuses it at the policy, but the
 * shape of the API should not invite the attempt).
 */
export async function listAllContentPages(
  supabase: Client,
): Promise<ContentPage[]> {
  const { data, error } = await supabase
    .from("content_pages")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (error) throw toAppError(error, "load the pages");

  return (data ?? []).map((row) => fold(row as Record<string, unknown>));
}

/** One page by id, in any state. For the editor. */
export async function getContentPageById(
  supabase: Client,
  id: string,
): Promise<ContentPage> {
  const { data, error } = await supabase
    .from("content_pages")
    .select(COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the page");
  if (!data) throw notFoundOrForbidden("Page");

  return fold(data as unknown as Record<string, unknown>);
}

/**
 * Creates or updates a page and its three translations.
 *
 * The parent row and the translations are written in two statements rather than
 * one RPC, and the order matters: the translations carry a foreign key to the
 * page, so the page has to exist first. A failure between them leaves a page
 * with stale translations rather than orphaned ones — recoverable by saving
 * again, which is the better of the two failure modes available without a
 * transaction.
 *
 * PostgREST has no interactive transaction, so a genuinely atomic save would
 * need a `plpgsql` function. That is worth doing the day an editor loses work to
 * this; it has not happened, and a stored procedure is a second place for the
 * validation to drift out of step with the Zod schema.
 */
export async function saveContentPage(
  supabase: Client,
  input: {
    id?: string;
    key: string;
    isPublished: boolean;
    displayOrder: number;
    translations: Record<
      Locale,
      {
        title: string;
        excerpt: string | null;
        body: string | null;
        seoTitle: string | null;
        seoDescription: string | null;
      }
    >;
  },
): Promise<ContentPage> {
  /*
    `published_at` travels with `is_published`.

    `content_pages_published_requires_date` refuses a published row with a null
    date, so setting the flag alone fails the insert — silently, from the form's
    point of view, because PostgREST reports it as a check violation the operator
    cannot act on. Publishing stamps the date; unpublishing clears it, so a page
    that goes back to draft does not keep claiming a publication date it no
    longer has.
  */
  const parent = {
    key: input.key,
    is_published: input.isPublished,
    published_at: input.isPublished ? new Date().toISOString() : null,
    display_order: input.displayOrder,
  };

  const { data: page, error: pageError } = input.id
    ? await supabase
        .from("content_pages")
        .update(parent)
        .eq("id", input.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("content_pages")
        .insert(parent)
        .select("id")
        .maybeSingle();

  if (pageError) throw toAppError(pageError, "save the page");
  if (!page) throw notFoundOrForbidden("Page");

  const rows = Object.entries(input.translations).map(([locale, value]) => ({
    page_id: page.id,
    locale: locale as Locale,
    title: value.title,
    excerpt: value.excerpt,
    body: value.body,
    seo_title: value.seoTitle,
    seo_description: value.seoDescription,
  }));

  const { error: translationError } = await supabase
    .from("content_page_translations")
    .upsert(rows, { onConflict: "page_id,locale" });

  if (translationError) throw toAppError(translationError, "save the page");

  return getContentPageById(supabase, page.id);
}

/**
 * Publishes or unpublishes a page.
 *
 * Separate from `saveContentPage` because it is the one operation an editor
 * performs from the list without opening the form, and because the two have
 * different stakes: a typo in the body is a typo, and an accidental publish puts
 * unfinished copy on a public URL.
 */
export async function setContentPagePublished(
  supabase: Client,
  id: string,
  isPublished: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("content_pages")
    .update({
      is_published: isPublished,
      // Required by `content_pages_published_requires_date`; see saveContentPage.
      published_at: isPublished ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) throw toAppError(error, "update the page");
}

/**
 * Soft-deletes a page.
 *
 * `deleted_at`, not a row removal: the storefront links to these pages from the
 * footer, and a hard delete would turn a link somebody has bookmarked into a
 * 404 with nothing left to explain what used to be there. Every read in this
 * service already filters on `deleted_at is null`.
 */
export async function deleteContentPage(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("content_pages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw toAppError(error, "delete the page");
}

/** Every published page, in display order. */
export async function listContentPages(
  supabase: Client,
): Promise<ContentPage[]> {
  const { data, error } = await supabase
    .from("content_pages")
    .select(COLUMNS)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (error) throw toAppError(error, "load the pages");

  return (data ?? []).map((row) => fold(row as Record<string, unknown>));
}
