/**
 * Static, non-secret configuration for the storefront.
 *
 * This module has no imports on purpose. It is read by both Server and Client
 * Components, by `utils/` (which may not import `lib/*` beyond this file), and
 * by the Edge middleware chain — so pulling in `lib/env.ts` here would drag Zod
 * and the whole environment schema into the client bundle and into middleware.
 *
 * This is application configuration — not content and not seeded data. Anything
 * merchandising-related (categories, banners, promotions) belongs in Supabase.
 */

/**
 * Supported locales, in the order they are offered in the language switcher.
 *
 * The codes are the URL prefixes (`/uz`, `/ru`, `/en`) and the keys of every
 * `messages/` folder and every localized content field. Uzbek is first because
 * it is the default.
 */
export const locales = ["uz", "ru", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uz";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}

/**
 * Per-locale data that is *not* translatable copy.
 *
 * `tag` is the BCP 47 identifier handed to `Intl` and to `<html lang>`; it is
 * deliberately distinct from the URL code, because `uz` alone leaves the region
 * unspecified and `Intl` then picks its own default for grouping separators and
 * date order.
 *
 * `label` is written in the language itself, never translated. A language
 * switcher that renders "Russian" to someone who only reads Russian has failed
 * at the one job it has, so these strings live here rather than in `messages/`.
 */
export const localeConfig = {
  uz: {
    tag: "uz-UZ",
    label: "O'zbekcha",
    /** Open Graph wants an underscored POSIX-style tag. */
    openGraph: "uz_UZ",
  },
  ru: {
    tag: "ru-RU",
    label: "Русский",
    openGraph: "ru_RU",
  },
  en: {
    tag: "en-US",
    label: "English",
    openGraph: "en_US",
  },
} as const satisfies Record<
  Locale,
  { tag: string; label: string; openGraph: string }
>;

export const siteConfig = {
  name: "Bondo",
  /**
   * ISO 4217 code. Prices are stored as integer minor units of this currency
   * (ADR-2). One store-wide currency is deliberate — multi-currency needs a
   * `currency` column on every priced row (D-9). Locale changes how an amount
   * is *formatted*, never which currency it is in.
   */
  currency: "USD",
} as const;

export type SiteConfig = typeof siteConfig;
