import type { SupabaseClient } from "@supabase/supabase-js";

import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import { toLocalizedText } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import type { LocalizedText } from "@/types/catalog";
import type { Database, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ServiceHighlight = Pick<
  Tables<"service_highlights">,
  "id" | "icon" | "display_order" | "is_visible"
> & {
  /** Folded from the translation rows; no caller sees a locale row. */
  title: LocalizedText;
  description: LocalizedText;
};

const COLUMNS = `id, icon, display_order, is_visible,
   translations:service_highlight_translations ( locale, title, description )`;

type TranslationRow = { locale: Locale; title: string; description: string };

function fold(row: Record<string, unknown>): ServiceHighlight {
  const translations = (row.translations ?? []) as TranslationRow[];

  return {
    id: row.id as string,
    icon: row.icon as string,
    display_order: row.display_order as number,
    is_visible: row.is_visible as boolean,
    title: toLocalizedText(translations, "title"),
    description: toLocalizedText(translations, "description"),
  };
}

/**
 * Highlights in display order.
 *
 * `visibleOnly` is what separates the storefront's read from the admin's. RLS
 * enforces it independently — an anonymous caller only ever sees visible rows
 * whatever this argument says — so passing `false` from the storefront would
 * return the same list rather than leak anything. The flag exists so the admin
 * can see what it is managing.
 */
export async function listHighlights(
  supabase: Client,
  options: { visibleOnly?: boolean } = {},
): Promise<ServiceHighlight[]> {
  let query = supabase
    .from("service_highlights")
    .select(COLUMNS)
    .order("display_order", { ascending: true });

  if (options.visibleOnly) query = query.eq("is_visible", true);

  const { data, error } = await query;
  if (error) throw toAppError(error, "load the service highlights");

  return (data ?? []).map((row) =>
    fold(row as unknown as Record<string, unknown>),
  );
}

export async function getHighlight(
  supabase: Client,
  id: string,
): Promise<ServiceHighlight> {
  const { data, error } = await supabase
    .from("service_highlights")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw toAppError(error, "load the highlight");
  if (!data) throw notFoundOrForbidden("Highlight");

  return fold(data as unknown as Record<string, unknown>);
}

export type HighlightInput = {
  icon: string;
  displayOrder: number;
  isVisible: boolean;
  /** All three languages, always. A highlight with a missing language renders a gap. */
  translations: Record<Locale, { title: string; description: string }>;
};

/**
 * Writes a highlight and its three translations.
 *
 * Used by both create and update, because the difference between them is one
 * `id` and PostgREST's `upsert` handles the rest. The translations are upserted
 * on the composite key rather than deleted and re-inserted: a delete-then-insert
 * would briefly leave a highlight with no copy, and the storefront reads this
 * table without a transaction around it.
 */
export async function saveHighlight(
  supabase: Client,
  input: HighlightInput & { id?: string },
): Promise<ServiceHighlight> {
  const { data, error } = await supabase
    .from("service_highlights")
    .upsert({
      ...(input.id ? { id: input.id } : {}),
      icon: input.icon,
      display_order: input.displayOrder,
      is_visible: input.isVisible,
    })
    .select("id")
    .single();

  if (error) throw toAppError(error, "save the highlight");

  const rows = (
    Object.entries(input.translations) as [
      Locale,
      { title: string; description: string },
    ][]
  ).map(([locale, copy]) => ({
    highlight_id: data.id,
    locale,
    title: copy.title,
    description: copy.description,
  }));

  const { error: translationError } = await supabase
    .from("service_highlight_translations")
    .upsert(rows, { onConflict: "highlight_id,locale" });

  if (translationError) {
    throw toAppError(translationError, "save the highlight's translations");
  }

  return getHighlight(supabase, data.id);
}

export async function deleteHighlight(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("service_highlights")
    .delete()
    .eq("id", id);

  if (error) throw toAppError(error, "delete the highlight");
}

/**
 * Persists a new order.
 *
 * Takes the whole ordered list rather than a single move. A "move up" endpoint
 * has to read the neighbour, swap two rows and hope nothing else reordered in
 * between; sending the final sequence makes the write idempotent and lets the
 * client render the result before the round trip.
 */
export async function reorderHighlights(
  supabase: Client,
  orderedIds: string[],
): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("service_highlights")
      .update({ display_order: index + 1 })
      .eq("id", id),
  );

  const results = await Promise.all(updates);
  const failure = results.find((result) => result.error);

  if (failure?.error) {
    throw toAppError(failure.error, "reorder the highlights");
  }
}

export async function setHighlightVisibility(
  supabase: Client,
  id: string,
  isVisible: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("service_highlights")
    .update({ is_visible: isVisible })
    .eq("id", id);

  if (error) throw toAppError(error, "change the highlight's visibility");
}
