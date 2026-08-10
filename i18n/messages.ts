import type { Locale } from "@/lib/site-config";

/**
 * The translation namespaces, one JSON file per namespace per locale.
 *
 * Translations are split by feature rather than kept in one file because one
 * file is where merge conflicts live: every feature branch touching the UI edits
 * the same lines in three languages. A namespace is also the unit a component
 * asks for — `useTranslations("catalog")` — so the split matches how the
 * strings are consumed, not just how they are stored.
 *
 * Adding a namespace means adding the file in **all three** locales.
 * `npm run check` fails otherwise (`scripts/check-translations.mjs`).
 */
export const namespaces = [
  "common",
  "header",
  "footer",
  "home",
  "catalog",
  "product",
  "newsletter",
  "errors",
  "auth",
  "account",
  "checkout",
  // The five business-information pages: their chrome, not their copy. The copy
  // lives on `content_pages` rows (ADR-39 — a delivery policy is written by the
  // business and changes without a deploy; "Need a hand?" is interface).
  "info",
  // Admin. Split from the storefront namespaces because they are a different
  // audience with a different vocabulary — and because a shopper's bundle has
  // no reason to carry the word "Bulk actions" in three languages.
  "admin",
  "adminDashboard",
  "adminCatalog",
  "adminInventory",
  "adminContent",
  "adminSystem",
  "adminHighlights",
] as const;

export type Namespace = (typeof namespaces)[number];

/**
 * Loads and merges every namespace for one locale.
 *
 * The import specifier is a template rather than a static path, so the bundler
 * emits one chunk per JSON file and a request for Russian never carries the
 * Uzbek or English copy. This runs on the server only — `i18n/request.ts` is the
 * sole caller — so the messages a client receives are whatever next-intl decides
 * to serialise for the components actually rendered.
 */
export async function loadMessages(locale: Locale) {
  const loaded = await Promise.all(
    namespaces.map(async (namespace) => {
      try {
        // Not named `module`: webpack treats that identifier as its own module
        // wrapper, and Next.js lints against shadowing it.
        const loaded = await import(`../messages/${locale}/${namespace}.json`);
        return [namespace, loaded.default] as const;
      } catch (cause) {
        // The bare module-not-found this would otherwise throw names a path
        // inside a webpack context module and not the missing translation, so
        // it is rewritten into the sentence that says what to do about it.
        throw new Error(
          `Missing translations: messages/${locale}/${namespace}.json. ` +
            `Every namespace must exist in every locale — see CLAUDE.md § 11.`,
          { cause },
        );
      }
    }),
  );

  return Object.fromEntries(loaded);
}
