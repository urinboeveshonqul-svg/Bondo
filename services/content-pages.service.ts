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
