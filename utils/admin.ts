import type { ProductStatus, ProductVariant } from "@/types/catalog";

/**
 * Derived values for the admin interface. Pure functions, no framework imports
 * — declarations live in `types/`, logic lives here (ADR-9).
 */

/**
 * What a product's publishing state *actually* is right now.
 *
 * `status` alone is not the answer: a product marked `published` with a
 * `scheduledFor` in the future is not live, and showing it as "Published" is a
 * lie the merchandiser only discovers by checking the storefront. Resolving the
 * two fields in one place means the badge, the filter and the eventual query
 * agree.
 */
export type PublishState = ProductStatus | "scheduled";

export function publishState(
  product: { status: ProductStatus; scheduledFor: string | null },
  now: Date = new Date(),
): PublishState {
  if (product.status !== "published") return product.status;
  if (!product.scheduledFor) return "published";

  return new Date(product.scheduledFor) > now ? "scheduled" : "published";
}

/**
 * Total sellable stock across a product's variants, falling back to the
 * product's own figure when it has none.
 *
 * A product with variants has no stock of its own — the number on the card is
 * the sum of its configurations, and treating the parent's field as
 * authoritative is how an out-of-stock product shows as available.
 */
export function totalStock(product: {
  stock: number;
  variants?: readonly ProductVariant[];
}): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) return product.stock;

  return variants
    .filter((variant) => variant.isActive)
    .reduce((sum, variant) => sum + variant.stock, 0);
}

/**
 * The price range a product sells at, as minor units.
 *
 * Returns equal bounds when there is one price, so callers render "$1,499" or
 * "$1,499 – $2,299" from the same shape without a second code path.
 */
export function priceRange(product: {
  priceCents: number;
  salePriceCents: number | null;
  variants?: readonly ProductVariant[];
}): { minCents: number; maxCents: number } {
  const variants = (product.variants ?? []).filter((v) => v.isActive);

  if (variants.length === 0) {
    const effective = product.salePriceCents ?? product.priceCents;
    return { minCents: effective, maxCents: effective };
  }

  const prices = variants.map((v) => v.salePriceCents ?? v.priceCents);

  return { minCents: Math.min(...prices), maxCents: Math.max(...prices) };
}

/**
 * Every combination of the given option values, in a stable order.
 *
 * Used when generating a variant matrix. Guards against the combinatorial
 * blow-up: three axes with five values each is 125 rows, which is a mistake
 * rather than a catalog, so callers are given the count and decide.
 */
export function optionCombinations(
  axes: readonly { key: string; values: readonly string[] }[],
): Record<string, string>[] {
  return axes.reduce<Record<string, string>[]>(
    (combinations, axis) =>
      combinations.flatMap((combination) =>
        axis.values.map((value) => ({ ...combination, [axis.key]: value })),
      ),
    [{}],
  );
}

/** Percentage change between two periods, or `null` when the base is zero. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null;

  return ((current - previous) / previous) * 100;
}
