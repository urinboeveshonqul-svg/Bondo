import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";

import { localeConfig, siteConfig, type Locale } from "@/lib/site-config";
import { loadMessages } from "./messages";
import { routing } from "./routing";

/**
 * Per-request i18n configuration. Next.js loads this file by convention — it is
 * named in `next.config.ts` via the next-intl plugin — and nothing else should
 * import it.
 *
 * `requestLocale` is whatever the `[locale]` segment matched, which is user
 * input: a request for `/de/products` reaches here with `"de"`. Validating it
 * against the routing contract rather than trusting the segment is what stops an
 * arbitrary path fragment from being used to probe for message files.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),

    /**
     * Pinned so a price or a date renders identically on the server and on the
     * client. Without it next-intl warns, and dates formatted during SSR use the
     * server's zone while a client re-render uses the visitor's — a hydration
     * mismatch that surfaces as an order date shifting by a day.
     *
     * Asia/Tashkent is the store's zone, and the store's zone is what an order
     * timestamp means.
     */
    timeZone: "Asia/Tashkent",

    /**
     * Shared format definitions, so `t("...", {price})` renders the same
     * anywhere it appears instead of each call site passing its own options.
     */
    formats: {
      number: {
        price: {
          style: "currency",
          currency: siteConfig.currency,
        },
      },
      dateTime: {
        short: { dateStyle: "medium" },
        long: { dateStyle: "long", timeStyle: "short" },
      },
    },

    /**
     * A missing or malformed message must not blank a page. In development it
     * throws so the gap is impossible to miss; in production it renders the key
     * path, which is ugly but leaves the rest of the page intact and is
     * greppable in a screenshot.
     */
    onError(error) {
      if (process.env.NODE_ENV === "development") throw error;
      console.error(`[i18n] ${localeConfig[locale].tag}: ${error.message}`);
    },
  };
});
