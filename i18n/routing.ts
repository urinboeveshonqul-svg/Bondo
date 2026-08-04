import { defineRouting } from "next-intl/routing";

// Relative, not the `@/` alias — this module is reachable from `middleware.ts`,
// and Vercel resolves that import graph itself, from source, without applying
// tsconfig `paths` (ADR-34). The rule is transitive: everything middleware can
// reach imports by relative path.
import { defaultLocale, locales } from "../lib/site-config";

/**
 * Locale routing contract, shared by the middleware, the navigation helpers and
 * the request config so there is exactly one place that decides how a locale
 * appears in a URL.
 *
 * `localePrefix: "always"` means the default locale is prefixed too: Uzbek lives
 * at `/uz`, not at `/`. The alternative — an unprefixed default — gives every
 * Uzbek page two addresses, which costs a canonical tag on every route to stop
 * crawlers treating the site as duplicated, and makes `hreflang` a special case
 * for one locale out of three. One shape for all three locales is worth the
 * redirect from `/`.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",

  /**
   * Persists the visitor's choice for a year. next-intl reads this cookie ahead
   * of `Accept-Language`, so a switch made once is honoured on the next visit
   * even when the browser asks for something else.
   *
   * `sameSite: "lax"` rather than `strict`: the cookie carries a display
   * preference, not authority, and `strict` would drop it on every inbound link
   * from a search engine — exactly the visit where getting the language right
   * matters most.
   */
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },

  /**
   * Falls back to `Accept-Language` for a first-time visitor with no cookie.
   * A visitor whose browser asks for none of the three lands on Uzbek.
   */
  localeDetection: true,
});
