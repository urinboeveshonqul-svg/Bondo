import type { OrderStatus } from "@/types/admin";
import type {
  ProductStatus,
  ProductVariant,
  ProductVisibility,
} from "@/types/catalog";

/**
 * Derived values for the admin interface. Pure functions, no framework imports
 * — declarations live in `types/`, logic lives here (ADR-9).
 */

/**
 * What a product's publishing state *actually* is right now.
 *
 * Three database fields decide it, and no one of them is the answer:
 *
 *  - `status` — is the work finished? (`draft | active | archived`)
 *  - `visibility` — should anyone see it? (`public | hidden`)
 *  - `scheduledFor` — from when?
 *
 * An `active` product that is `hidden`, or whose date has not arrived, is not
 * live — and showing it as "Active" is a lie the merchandiser discovers by
 * checking the storefront. Resolving all three in one place is what keeps the
 * badge, the filter and the eventual query agreeing.
 *
 * The derived states are **not** stored: `scheduled` and `hidden` are readings
 * of the columns above, which is why this is a function rather than a fourth
 * enum value the database would have to carry.
 */
export type PublishState = ProductStatus | "scheduled" | "hidden";

export function publishState(
  product: {
    status: ProductStatus;
    visibility: ProductVisibility;
    scheduledFor: string | null;
  },
  now: Date = new Date(),
): PublishState {
  // Unfinished or retired: visibility is irrelevant, the work state wins.
  if (product.status !== "active") return product.status;

  if (product.visibility === "hidden") return "hidden";
  if (!product.scheduledFor) return "active";

  return new Date(product.scheduledFor) > now ? "scheduled" : "active";
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

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

/**
 * The pipeline, in the order an operator walks it.
 *
 * `cancelled` is deliberately absent: it is reachable from anywhere and is not a
 * step, so a progress indicator that included it would draw it as one. Callers
 * that need every value use `Constants.public.Enums.order_status`.
 *
 * Listing the order here rather than reading it off the enum keeps the sequence
 * of a business workflow from being an accident of how the DDL was typed — but
 * `satisfies` means a value renamed in the schema still fails to compile.
 */
export const ORDER_STATUS_FLOW = [
  "new",
  "contacted",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
] as const satisfies readonly OrderStatus[];

/**
 * Where an order sits in the pipeline, as a 1-based step, or `null` when it is
 * cancelled and therefore nowhere on it.
 */
export function orderProgress(
  status: OrderStatus,
): { step: number; of: number } | null {
  const index = ORDER_STATUS_FLOW.indexOf(
    status as (typeof ORDER_STATUS_FLOW)[number],
  );

  return index === -1
    ? null
    : { step: index + 1, of: ORDER_STATUS_FLOW.length };
}

/**
 * The statuses an order may legally move to next.
 *
 * Forward one step, or cancelled — never backwards. An operator who marked an
 * order delivered by mistake needs a colleague and an audit trail, not an undo
 * button, because "delivered" is what unlocks the customer's right to review it
 * (ADR-66) and reversing it silently would strand a review that already exists.
 *
 * A delivered or cancelled order is terminal and returns an empty list, which is
 * what makes the admin's status control disappear rather than offer a no-op.
 */
export function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  if (status === "delivered" || status === "cancelled") return [];

  const index = ORDER_STATUS_FLOW.indexOf(
    status as (typeof ORDER_STATUS_FLOW)[number],
  );

  const forward = ORDER_STATUS_FLOW[index + 1];

  return forward ? [forward, "cancelled"] : ["cancelled"];
}

/** Percentage change between two periods, or `null` when the base is zero. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return null;

  return ((current - previous) / previous) * 100;
}
