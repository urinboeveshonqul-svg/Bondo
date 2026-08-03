import type { Discount, ProductSummary, StockLevel } from "@/types/catalog";

/**
 * Derived catalog values.
 *
 * Pure functions with no imports beyond types, so they stay in `utils/` and can
 * be called from Server and Client Components alike without dragging anything
 * into a bundle (ADR-10).
 */

/** How many units still count as "only a few left" in the UI. */
const LOW_STOCK_THRESHOLD = 5;

/**
 * The discount a product is currently showing, or `null`.
 *
 * Derived rather than stored: a persisted percentage is a second copy of the
 * two prices and drifts the moment either changes — the same reasoning that
 * keeps stock out of `products` (ADR-24). Whole percent, rounded, because
 * "23.4% off" is not a thing shops say.
 */
export function getDiscount(
  product: Pick<ProductSummary, "priceCents" | "salePriceCents">,
): Discount | null {
  const { priceCents, salePriceCents } = product;
  if (salePriceCents === null || salePriceCents >= priceCents) return null;

  const savingCents = priceCents - salePriceCents;
  return {
    percent: Math.round((savingCents / priceCents) * 100),
    savingCents,
  };
}

/** The price a shopper actually pays. */
export function getEffectivePriceCents(
  product: Pick<ProductSummary, "priceCents" | "salePriceCents">,
): number {
  return product.salePriceCents ?? product.priceCents;
}

export function getStockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out-of-stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in-stock";
}
