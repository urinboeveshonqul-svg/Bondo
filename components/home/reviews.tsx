import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";

import { Rating } from "@/components/commerce/rating";
import { Section } from "@/components/layout/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/site-config";
import type { Review } from "@/types/catalog";

/**
 * Customer reviews.
 *
 * Marked up as `<blockquote>` with `<cite>`, so the quotation and its
 * attribution are related in the accessibility tree rather than merely adjacent
 * on screen.
 *
 * The verified badge is meaningful, not decorative: in the schema a review can
 * only carry it when the reviewer's account has an order containing that
 * product. Showing it on unverified reviews would make it worthless.
 */
export function Reviews({ reviews }: { reviews: Review[] }) {
  const t = useTranslations("home.reviews");
  const locale = useLocale() as Locale;

  return (
    <Section id="reviews" title={t("title")} description={t("description")}>
      <ul className="grid gap-6 lg:grid-cols-3">
        {reviews.map((review) => (
          // `min-w-0` is load-bearing, not defensive. A grid item defaults to
          // `min-width: auto`, which refuses to shrink below its content's
          // min-content width — and the product name below sets that with
          // `truncate`'s `white-space: nowrap`. Without this the card measured
          // 339px inside a 288px column and pushed the whole document into
          // horizontal scroll at 320px.
          <li key={review.id} className="min-w-0">
            <figure className="flex h-full min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6">
              <Rating rating={review.rating} size="small" />

              <blockquote className="min-w-0 flex-1 space-y-2">
                <p className="font-medium tracking-tight break-words">
                  {review.title[locale]}
                </p>
                <p className="text-sm text-pretty break-words text-muted-foreground">
                  {review.body[locale]}
                </p>
              </blockquote>

              <figcaption className="flex min-w-0 items-center gap-3 border-t pt-4">
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs">
                    {review.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <cite className="flex items-center gap-1.5 text-sm font-medium not-italic">
                    {review.author}
                    {review.verified ? (
                      <>
                        <BadgeCheck
                          className="size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span className="sr-only">{t("verified")}</span>
                      </>
                    ) : null}
                  </cite>
                  <p className="truncate text-xs text-muted-foreground">
                    {review.productName}
                  </p>
                </div>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
