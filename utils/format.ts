import { siteConfig } from "@/lib/site-config";

/**
 * Presentation helpers. Pure functions — no I/O, no framework imports — so they
 * are safe in both Server and Client Components.
 *
 * `lib/site-config.ts` is importable here because it is a plain object literal
 * with no imports of its own. Nothing in this folder may import `lib/env.ts`,
 * `supabase/` or anything React: a formatter that drags Zod into the bundle
 * every time a price is rendered is not a utility.
 */

/**
 * `Intl` formatters are expensive to construct and are the hot path on a
 * catalog page rendering hundreds of prices. Constructing one per call showed
 * up as real time in list rendering, so they are memoised by their options.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }

  return formatter;
}

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }

  return formatter;
}

/**
 * Monetary amounts are stored as integer minor units (cents) to avoid floating
 * point drift, and only converted to a decimal string at render time.
 */
export function formatPrice(
  amountInMinorUnits: number,
  options: { currency?: string; locale?: string } = {},
): string {
  const { currency = siteConfig.currency, locale = siteConfig.locale } =
    options;

  return numberFormatter(locale, { style: "currency", currency }).format(
    amountInMinorUnits / 100,
  );
}

export function formatNumber(
  value: number,
  locale: string = siteConfig.locale,
): string {
  return numberFormatter(locale, {}).format(value);
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale: string = siteConfig.locale,
): string {
  return dateFormatter(locale, options).format(new Date(value));
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
