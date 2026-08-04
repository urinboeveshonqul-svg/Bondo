import { defaultLocale, locales, type Locale } from "@/lib/site-config";
import type { LocalizedText } from "@/types/catalog";

/**
 * The one place that converts between translation **rows** and the
 * `LocalizedText` the interface renders.
 *
 * The UI never learns how translations are stored — it holds
 * `{ uz, ru, en }` and this module folds that into rows on the way down and
 * back out on the way up. Every service uses these, so the shape is decided
 * once: a second hand-rolled fold is how one entity ends up dropping a language
 * on save.
 *
 * Pure. No Supabase import, no React — callable from a service, a script or a
 * test.
 */

/** A translation row as it comes back from any `*_translations` table. */
type TranslationRow = { locale: Locale } & Record<string, unknown>;

/** An empty value for every locale, so a field is never `undefined`. */
export function emptyLocalizedText(): LocalizedText {
  return Object.fromEntries(
    locales.map((locale) => [locale, ""]),
  ) as LocalizedText;
}

/**
 * Folds one column of a translation set into a `LocalizedText`.
 *
 * Missing locales become `""` rather than being absent: a form binding to
 * `value.ru` must not read `undefined`, and "not translated yet" is a real,
 * displayable state — it is what `TranslationStatus` reports.
 */
export function toLocalizedText<T extends TranslationRow>(
  rows: readonly T[],
  column: keyof T,
): LocalizedText {
  const result = emptyLocalizedText();

  for (const row of rows) {
    const value = row[column];
    if (typeof value === "string") result[row.locale] = value;
  }

  return result;
}

/**
 * Reads a `LocalizedText` for one locale, falling back to the default.
 *
 * **Fallback is deliberate and one level deep.** Showing an empty product name
 * because nobody has written the Uzbek yet is worse than showing the Uzbek
 * default — a blank card looks broken, whereas a name in another language is
 * visibly untranslated and still usable. It never chains further than the
 * default locale, so the fallback can never mask which language is missing.
 */
export function pick(
  text: LocalizedText | null | undefined,
  locale: Locale,
): string {
  if (!text) return "";

  const value = text[locale]?.trim();
  if (value) return value;

  return text[defaultLocale]?.trim() ?? "";
}

/**
 * Turns a `LocalizedText` (or several) into rows ready to upsert.
 *
 * Locales whose every field is blank are **omitted**, not written as empty
 * strings: a row of empty text claims a translation exists, which breaks both
 * the completeness indicator and the `not null` constraint on `name`.
 *
 * @param key the parent-id column and value, e.g. `{ product_id: id }`.
 * @param fields column name → the localized value for it.
 */
export function toTranslationRows<K extends Record<string, string>>(
  key: K,
  fields: Record<string, LocalizedText | readonly string[] | null | undefined>,
): (K & { locale: Locale } & Record<string, unknown>)[] {
  const rows: (K & { locale: Locale } & Record<string, unknown>)[] = [];

  for (const locale of locales) {
    const row: Record<string, unknown> = { ...key, locale };
    let hasContent = false;

    for (const [column, value] of Object.entries(fields)) {
      if (value === null || value === undefined) continue;

      // A string[] is not localized — SEO keywords are search terms that cross
      // languages — so it is written identically to every locale's row.
      if (Array.isArray(value)) {
        row[column] = value;
        continue;
      }

      const text = (value as LocalizedText)[locale]?.trim() ?? "";
      row[column] = text || null;
      if (text) hasContent = true;
    }

    if (hasContent) rows.push(row as K & { locale: Locale });
  }

  return rows;
}

/** Which locales have content for a field, and which do not. */
export type TranslationCoverage = {
  filled: Locale[];
  missing: Locale[];
  /** 0–1. What `TranslationProgress` renders. */
  ratio: number;
  isComplete: boolean;
};

/**
 * Coverage across one or more localized fields.
 *
 * A locale counts as covered only when **every** required field has content:
 * a product with a Russian name and no Russian description is not translated
 * into Russian, and reporting it as complete is how a half-translated page
 * reaches a customer.
 */
export function coverageOf(
  fields: readonly (LocalizedText | null | undefined)[],
): TranslationCoverage {
  const present = fields.filter(Boolean) as LocalizedText[];

  const filled = locales.filter((locale) =>
    present.every((field) => field[locale]?.trim()),
  );
  const missing = locales.filter((locale) => !filled.includes(locale));

  return {
    filled,
    missing,
    ratio: filled.length / locales.length,
    isComplete: missing.length === 0,
  };
}

/**
 * Whether a record may be published.
 *
 * The rule the whole policy rests on: **a record is not publishable until every
 * supported language has content.** Publishing a product that exists only in
 * English puts an untranslated page in front of an Uzbek shopper, which is the
 * failure the translation architecture exists to prevent — so it is checked
 * here, once, rather than remembered at each call site.
 */
export function isPublishable(
  fields: readonly (LocalizedText | null | undefined)[],
): boolean {
  return coverageOf(fields).isComplete;
}
