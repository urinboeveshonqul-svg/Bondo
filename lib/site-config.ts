/**
 * Static, non-secret configuration for the storefront.
 *
 * This module has no imports on purpose. It is read by both Server and Client
 * Components, so pulling in `lib/env.ts` here would drag Zod and the whole
 * environment schema into the client bundle. The deployment URL is environment
 * data and lives in `lib/env.ts` as `NEXT_PUBLIC_SITE_URL`.
 *
 * This is application configuration — not content and not seeded data. Anything
 * merchandising-related (categories, banners, promotions) belongs in Supabase.
 */
export const siteConfig = {
  name: "Bondo",
  shortDescription: "Computers, components and accessories.",
  description:
    "Bondo is a computer store selling laptops, desktops, components and accessories.",
  /** BCP 47 tag. Drives `<html lang>` and every `Intl` formatter. */
  locale: "en-US",
  /** ISO 4217 code. Prices are stored as integer minor units of this currency. */
  currency: "USD",
} as const;

export type SiteConfig = typeof siteConfig;
