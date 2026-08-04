import { localizePath } from "@/lib/routes";
import { defaultLocale, locales, type Locale } from "@/lib/site-config";

/**
 * Builds the `alternates` block for a page: its canonical URL plus one
 * `hreflang` entry per locale.
 *
 * Every localized page needs all three links, and they have to point at *that*
 * page rather than at the locale root — `hreflang` telling Google that the
 * Russian alternate of a product page is the Uzbek home page is worse than
 * omitting it, because it invites the wrong page into the wrong index.
 * Generating them from one unprefixed path makes that mistake impossible to
 * make by hand.
 *
 * `x-default` points at Uzbek, the default locale: it is what a crawler serves
 * to a visitor whose language matches none of the three, and it must be a real
 * page rather than a language selector, because there isn't one.
 *
 * Paths are relative; `metadataBase` in the locale layout resolves them.
 *
 * @param pathname an unprefixed route from `lib/routes.ts`, e.g. `/products`.
 */
export function localeAlternates(locale: Locale, pathname: string) {
  const languages: Record<string, string> = {};

  for (const alternate of locales) {
    languages[alternate] = localizePath(alternate, pathname);
  }

  languages["x-default"] = localizePath(defaultLocale, pathname);

  return {
    canonical: localizePath(locale, pathname),
    languages,
  };
}
