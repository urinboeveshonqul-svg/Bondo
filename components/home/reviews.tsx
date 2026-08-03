import { BadgeCheck } from "lucide-react";

import { Rating } from "@/components/commerce/rating";
import { Section } from "@/components/layout/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  return (
    <Section
      title="What customers say"
      description="Reviews from people who bought the product they are describing."
    >
      <ul className="grid gap-6 lg:grid-cols-3">
        {reviews.map((review) => (
          <li key={review.id}>
            <figure className="flex h-full flex-col gap-4 rounded-xl border bg-card p-6">
              <Rating rating={review.rating} size="small" />

              <blockquote className="flex-1 space-y-2">
                <p className="font-medium tracking-tight">{review.title}</p>
                <p className="text-sm text-pretty text-muted-foreground">
                  {review.body}
                </p>
              </blockquote>

              <figcaption className="flex items-center gap-3 border-t pt-4">
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
                        <span className="sr-only">Verified purchase</span>
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
