"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { requirePermission } from "@/lib/admin/action-guard";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as inventoryService from "@/services/inventory.service";

/**
 * Stock adjustments.
 *
 * ## Why an adjustment and not a new quantity
 *
 * The form asks for a delta and a reason, never for "the stock is now 12".
 * `inventory.quantity_on_hand` is maintained by the `inventory_movements_apply`
 * trigger and a second trigger rejects every other write to it (ADR-24,
 * ADR-27), so a "set to 12" control would have to be implemented as a computed
 * delta — and would race with any concurrent movement between the read and the
 * write. Recording the delta lets the trigger compute `quantity_after` while
 * holding the row, which is the only value that cannot be stale.
 *
 * The reason survives in `inventory_movements` either way, which is the point of
 * a ledger: an operator correcting a miscount leaves evidence of the correction
 * rather than overwriting the number that was wrong.
 */

/**
 * The movement types an operator may pick.
 *
 * Derived from the database enum rather than re-typed (§ 12), minus the ones an
 * operator must not raise by hand: `sale` and `return` belong to checkout and
 * to the returns flow, and letting somebody type one here would put a movement
 * in the ledger that no order explains.
 *
 * `return` stays: until the returns flow exists, a customer bringing something
 * back is a movement an operator records by hand, and refusing it here would
 * leave stock that physically came back missing from the count.
 *
 * This list is the one the dialog offers (`REASONS` in `inventory-manager`).
 * They have to agree — a type the form shows and the action rejects is a form
 * that fails after it has been filled in, which is **K-16** exactly.
 */
const OPERATOR_MOVEMENTS = [
  "purchase",
  "return",
  "adjustment",
  "correction",
] as const;

const adjustmentSchema = z.object({
  productId: z.uuid(),
  movementType: z.enum(OPERATOR_MOVEMENTS),
  // Signed and non-zero: the service rejects zero as well, because a movement
  // that changes nothing is a row that explains nothing.
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, "adminInventory.errors.deltaRequired")
    .refine(
      (value) => Math.abs(value) <= 100_000,
      "adminInventory.errors.deltaTooLarge",
    ),
  reason: z.string().trim().max(280).optional(),
});

function revalidateInventory(): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}${routes.admin.inventory}`);
    // Stock decides the storefront's availability copy, so the catalog is stale
    // the moment a movement lands.
    revalidatePath(`/${locale}${routes.catalog.index}`);
  }
}

export const recordStockMovement = createAction(
  "recordStockMovement",
  adjustmentSchema,
  async (input) => {
    await requirePermission("inventory.adjust");

    const supabase = await createClient();
    const movement = await inventoryService.recordMovement(supabase, {
      productId: input.productId,
      movementType: input.movementType,
      quantityDelta: input.quantityDelta,
      reason: input.reason?.length ? input.reason : null,
    });

    revalidateInventory();

    return {
      id: movement.id,
      quantityAfter: movement.quantity_after,
    };
  },
);

export const updateStockSettings = createAction(
  "updateStockSettings",
  z.object({
    productId: z.uuid(),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    allowBackorder: z.boolean(),
  }),
  async (input) => {
    // Configuration, not a quantity — but the same permission: somebody who may
    // not move stock may not silence the low-stock warning about it either.
    await requirePermission("inventory.adjust");

    const supabase = await createClient();
    const inventory = await inventoryService.updateInventorySettings(
      supabase,
      input.productId,
      {
        low_stock_threshold: input.lowStockThreshold,
        allow_backorder: input.allowBackorder,
      },
    );

    revalidateInventory();

    return {
      lowStockThreshold: inventory.low_stock_threshold,
      allowBackorder: inventory.allow_backorder,
    };
  },
);
