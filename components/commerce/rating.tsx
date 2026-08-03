import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/format";

/**
 * Star rating.
 *
 * The stars are decorative — `aria-hidden` — because a screen reader hearing
 * "star star star" learns nothing. The accessible name carries the number,
 * which is what the rating actually communicates.
 *
 * Partial fill is done with a clipped overlay rather than half-star glyphs, so
 * 4.3 reads as 4.3 rather than rounding to 4.5 and overstating the product.
 */
export function Rating({
  rating,
  reviewCount,
  size = "default",
  className,
}: {
  rating: number;
  reviewCount?: number;
  size?: "small" | "default";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, rating));
  const starSize = size === "small" ? "size-3.5" : "size-4";

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className="relative inline-flex shrink-0" aria-hidden="true">
        <span className="flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={cn(starSize, "text-muted-foreground/30")}
            />
          ))}
        </span>
        {/* The fill width is a computed percentage, so it cannot be a utility
            class. This is the only `style` prop in the design system: rounding
            to half-stars instead would round 4.3 up to 4.5 and overstate the
            product, which is a worse trade than one dynamic declaration. */}
        <span
          className="absolute inset-y-0 left-0 flex overflow-hidden"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              // Monochrome, not amber. The colour system reserves the accent
              // for discounts, so an orange star would make a 5-star rating
              // read as a price cut at a glance. Filled-vs-empty is the signal.
              className={cn(
                starSize,
                "shrink-0 fill-foreground text-foreground",
              )}
            />
          ))}
        </span>
      </span>

      <span
        className={cn(
          "text-muted-foreground tabular-nums",
          size === "small" ? "text-xs" : "text-sm",
        )}
      >
        {clamped.toFixed(1)}
        {reviewCount !== undefined ? (
          <span className="sr-only">
            {" "}
            out of 5, from {formatNumber(reviewCount)} reviews
          </span>
        ) : (
          <span className="sr-only"> out of 5</span>
        )}
      </span>

      {reviewCount !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            "text-muted-foreground tabular-nums",
            size === "small" ? "text-xs" : "text-sm",
          )}
        >
          ({formatNumber(reviewCount)})
        </span>
      ) : null}
    </span>
  );
}
