import { getLocale } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";

import { Container } from "@/components/layout/container";
import { logger } from "@/lib/logger";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as settingsService from "@/services/settings.service";

/**
 * The banners an operator has switched on, above the catalog.
 *
 * ## Why this exists
 *
 * `site_banners` has had a table, RLS, translations and a full admin editor for
 * some time, and **nothing on the storefront read it**. An operator could
 * create a banner, fill in three languages, switch it on and see no change
 * anywhere — which makes the switch a control over a row rather than over the
 * shop. This is the consumer that makes it mean something.
 *
 * ## What decides whether a banner appears
 *
 * Not this component. `listActiveBannersForLocale` asks for `is_active`, the
 * `starts_at`/`ends_at` window and the placement, all in the query, so a
 * scheduled banner never reaches the browser before its time — filtering after
 * fetching would ship next week's campaign to anyone reading the network tab.
 *
 * A banner with no row for the visitor's language is dropped rather than
 * rendered with an empty heading: the service does that, and it is the right
 * failure, because a blank hero looks broken to the visitor and fine to the
 * operator who only checked their own language.
 *
 * ## Degrades to nothing
 *
 * A failure here logs and renders nothing. The home page's job is the catalog;
 * a marketing strip that cannot load must not take the storefront with it, which
 * is the same rule the category navigation follows (**K-18**).
 */
export async function PromoBanners() {
  const locale = (await getLocale()) as Locale;

  const banners = await (async () => {
    try {
      const supabase = await createClient();
      return await settingsService.listActiveBannersForLocale(
        supabase,
        locale,
        "home_hero",
      );
    } catch (error) {
      unstable_rethrow(error);
      logger.error("[home] banners unavailable", error);
      return [];
    }
  })();

  if (banners.length === 0) return null;

  return (
    /* No aria-label: an unnamed <section> is not exposed as a landmark, which
       is right for a promotional strip. A named one would add a region to the
       screen-reader landmark list for two lines of marketing copy. */
    <section className="border-b bg-primary/5">
      <Container className="space-y-3 py-4">
        {banners.map((banner) => {
          const body = (
            <>
              <p className="font-medium text-balance">{banner.title}</p>
              {banner.subtitle ? (
                <p className="text-sm text-pretty text-muted-foreground">
                  {banner.subtitle}
                </p>
              ) : null}
            </>
          );

          // A banner is a link only when the operator gave it somewhere to go.
          // Wrapping every one in an anchor would put a pointer cursor on copy
          // that does nothing when tapped.
          return banner.linkUrl ? (
            <a
              key={banner.id}
              href={banner.linkUrl}
              className="flex min-h-11 flex-col justify-center rounded-lg px-1 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {body}
              {banner.ctaLabel ? (
                <span className="mt-1 text-sm font-medium text-primary">
                  {banner.ctaLabel} →
                </span>
              ) : null}
            </a>
          ) : (
            <div key={banner.id} className="px-1">
              {body}
            </div>
          );
        })}
      </Container>
    </section>
  );
}
