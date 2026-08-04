import { localeConfig, siteConfig, type Locale } from "@/lib/site-config";

/**
 * Presentation helpers. Pure functions — no I/O, no framework imports — so they
 * are safe in both Server and Client Components.
 *
 * `lib/site-config.ts` is importable here because it is a plain object literal
 * with no imports of its own. Nothing in this folder may import `lib/env.ts`,
 * `supabase/` or anything React: a formatter that drags Zod into the bundle
 * every time a price is rendered is not a utility.
 *
 * **Locale is a required argument, never defaulted.** A default would make the
 * wrong output the quiet outcome: every call site that forgot to pass one would
 * render Uzbek grouping to a Russian visitor and nothing would fail. Requiring
 * it turns the same mistake into a compile error. Components get the value from
 * `useLocale()`, which next-intl provides in Server and Client Components alike.
 */

/**
 * `Intl` formatters are expensive to construct and are the hot path on a
 * catalog page rendering hundreds of prices. Constructing one per call showed
 * up as real time in list rendering, so they are memoised by their options.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Maps a URL locale (`uz`) to the BCP 47 tag `Intl` needs (`uz-UZ`). */
function tagFor(locale: Locale): string {
  return localeConfig[locale].tag;
}

function numberFormatter(tag: string, options: Intl.NumberFormatOptions) {
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, options);
    numberFormatters.set(key, formatter);
  }

  return formatter;
}

function dateFormatter(tag: string, options: Intl.DateTimeFormatOptions) {
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, options);
    dateFormatters.set(key, formatter);
  }

  return formatter;
}

/**
 * Monetary amounts are stored as integer minor units (cents) to avoid floating
 * point drift, and only converted to a decimal string at render time.
 *
 * The currency does not change with the locale — there is one store-wide
 * currency (ADR-2, D-9). What changes is presentation: `$1,499.00` in English,
 * `1 499,00 $` in Russian. Same amount, same currency, local conventions.
 */
export function formatPrice(
  amountInMinorUnits: number,
  locale: Locale,
  options: { currency?: string } = {},
): string {
  const { currency = siteConfig.currency } = options;

  return numberFormatter(tagFor(locale), {
    style: "currency",
    currency,
  }).format(amountInMinorUnits / 100);
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormatter(tagFor(locale), {}).format(value);
}

export function formatDate(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return dateFormatter(tagFor(locale), options).format(new Date(value));
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
