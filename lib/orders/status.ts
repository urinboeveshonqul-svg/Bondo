import type { OrderStatus } from "@/types/admin";

/**
 * The customer-facing view of an order's progress.
 *
 * `ORDER_STATUS_FLOW` in `utils/admin.ts` is the operator's pipeline; this is
 * the same sequence read from the other side, plus the two things a customer
 * needs that an operator does not: which steps are behind them, and a sentence
 * explaining the one they are on.
 *
 * The copy lives in `messages/`, keyed by status — it is interface chrome
 * written by us, not content an operator authors, so ADR-39 puts it there rather
 * than on the row.
 */
export const CUSTOMER_STATUS_STEPS = [
  "new",
  "contacted",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
] as const satisfies readonly OrderStatus[];

export type CustomerStatusStep = (typeof CUSTOMER_STATUS_STEPS)[number];

export type TimelineStep = {
  status: CustomerStatusStep;
  state: "done" | "current" | "upcoming";
};

/**
 * The timeline for one order.
 *
 * Returns `null` for a cancelled order rather than a list with a break in it. A
 * cancelled order did not travel part of a pipeline and stop — it left it, and
 * drawing five greyed-out steps under a red banner tells the reader their order
 * is somehow still in progress.
 */
export function orderTimeline(status: OrderStatus): TimelineStep[] | null {
  if (status === "cancelled") return null;

  const index = CUSTOMER_STATUS_STEPS.indexOf(status as CustomerStatusStep);
  if (index === -1) return null;

  return CUSTOMER_STATUS_STEPS.map((step, i) => ({
    status: step,
    state: i < index ? "done" : i === index ? "current" : "upcoming",
  }));
}

/**
 * Whether the customer may review what they bought.
 *
 * One place, so the button on the order page and any future prompt cannot
 * disagree. It is a convenience, never the gate: the gate is the RLS policy that
 * the insert has to satisfy (ADR-66), and it checks the same fact independently.
 */
export function canReviewOrder(status: OrderStatus): boolean {
  return status === "delivered";
}
