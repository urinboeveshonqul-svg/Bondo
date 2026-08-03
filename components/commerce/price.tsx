import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";
import { getDiscount } from "@/utils/catalog";
import { formatPrice } from "@/utils/format";

/**
 * Price display, with the struck-through original when a promotion is running.
 *
 * Orange is reserved for discounts across the whole design system, so this and
 * `DiscountBadge` are the only components that reach for it. Using it anywhere
 * else would make a saving indistinguishable from decoration.
 */
export function Price({
  product,
  size = "default",
  className,
}: {
  product: Pick<ProductSummary, "priceCents" | "salePriceCents">;
  size?: "default" | "large";
  className?: string;
}) {
  const discount = getDiscount(product);
  const current = product.salePriceCents ?? product.priceCents;

  return (
    <p
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
    >
      <span
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "large" ? "text-3xl" : "text-lg",
          discount && "text-discount",
        )}
      >
        {formatPrice(current)}
      </span>

      {discount ? (
        <>
          {/* The original price is supplementary, so it is announced as such
              rather than read out as a second, contradictory price. */}
          <span className="sr-only">Was</span>
          <s
            className={cn(
              "text-muted-foreground tabular-nums",
              size === "large" ? "text-lg" : "text-sm",
            )}
          >
            {formatPrice(product.priceCents)}
          </s>
        </>
      ) : null}
    </p>
  );
}

/** The saving, as a percentage. Rendered only when there is one. */
export function DiscountBadge({
  product,
  className,
}: {
  product: Pick<ProductSummary, "priceCents" | "salePriceCents">;
  className?: string;
}) {
  const discount = getDiscount(product);
  if (!discount) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-discount px-2 py-0.5 text-xs font-semibold text-discount-foreground tabular-nums",
        className,
      )}
    >
      −{discount.percent}%
    </span>
  );
}
