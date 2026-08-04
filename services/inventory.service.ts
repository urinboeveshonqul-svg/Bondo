import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { Database, Enums, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

export type InventoryLevel = Pick<
  Tables<"inventory">,
  | "product_id"
  | "quantity_on_hand"
  | "quantity_reserved"
  | "low_stock_threshold"
  | "allow_backorder"
  | "updated_at"
> & {
  product: Pick<Tables<"products">, "id" | "name" | "sku" | "slug"> | null;
};

/**
 * Stock levels, joined to the product they belong to.
 *
 * One query with an embedded select rather than a list of ids followed by a
 * product lookup per row.
 */
export async function listInventory(
  supabase: Client,
  options: { lowStockOnly?: boolean; outOfStockOnly?: boolean } = {},
): Promise<InventoryLevel[]> {
  let query = supabase
    .from("inventory")
    .select(
      `product_id, quantity_on_hand, quantity_reserved, low_stock_threshold,
       allow_backorder, updated_at,
       product:products ( id, name, sku, slug )`,
    )
    .order("quantity_on_hand", { ascending: true });

  if (options.outOfStockOnly) query = query.eq("quantity_on_hand", 0);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list inventory");

  const rows = (data ?? []) as unknown as InventoryLevel[];

  // Low stock is `on_hand <= threshold`, a comparison between two columns.
  // PostgREST cannot express that in a filter, so it is applied here — a real
  // limitation worth naming rather than hiding: at scale this wants a generated
  // `is_low_stock` column or a view so the database can index it.
  return options.lowStockOnly
    ? rows.filter(
        (row) =>
          row.quantity_on_hand > 0 &&
          row.quantity_on_hand <= row.low_stock_threshold,
      )
    : rows;
}

export type MovementRow = Tables<"inventory_movements"> & {
  product: Pick<Tables<"products">, "id" | "name" | "sku"> | null;
};

export async function listMovements(
  supabase: Client,
  options: { productId?: string; limit?: number } = {},
): Promise<MovementRow[]> {
  let query = supabase
    .from("inventory_movements")
    .select(`*, product:products ( id, name, sku )`)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.productId) query = query.eq("product_id", options.productId);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list stock movements");

  return (data ?? []) as unknown as MovementRow[];
}

/**
 * Records a stock movement.
 *
 * **This is the only way stock changes.** `inventory.quantity_on_hand` is
 * maintained by the `inventory_movements_apply` trigger, and a second trigger
 * rejects any other write to it (ADR-27) — so there is deliberately no
 * `setStock()` in this service. An operator correcting a miscount records a
 * `correction`, and the reason survives in the ledger; an overwrite would
 * destroy exactly the history the ledger exists to keep.
 *
 * `quantity_after` is **not** passed in: the trigger computes it from the
 * current level, which is the only value that cannot race with a concurrent
 * movement.
 */
export async function recordMovement(
  supabase: Client,
  input: {
    productId: string;
    movementType: Enums<"inventory_movement_type">;
    quantityDelta: number;
    reason?: string | null;
    reference?: string | null;
  },
): Promise<Tables<"inventory_movements">> {
  if (input.quantityDelta === 0) {
    throw new AppError("validation", "A movement must change the quantity.");
  }

  const { data, error } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: input.productId,
      movement_type: input.movementType,
      quantity_delta: input.quantityDelta,
      reason: input.reason ?? null,
      reference: input.reference ?? null,
      // Required by the schema and overwritten by the trigger; the trigger is
      // authoritative because only it sees the current level under lock.
      quantity_after: 0,
    })
    .select()
    .single();

  if (error) throw toAppError(error, "record the stock movement");

  return data;
}

export async function getInventoryForProduct(
  supabase: Client,
  productId: string,
): Promise<Tables<"inventory">> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw toAppError(error, "load the stock level");
  if (!data) throw notFoundOrForbidden("Inventory record");

  return data;
}

/**
 * Threshold and backorder settings.
 *
 * Separated from `recordMovement` on purpose: these are configuration, and
 * allowing them through the same call as a quantity change is how an
 * "adjustment" quietly rewrites a threshold too.
 */
export async function updateInventorySettings(
  supabase: Client,
  productId: string,
  patch: { low_stock_threshold?: number; allow_backorder?: boolean },
): Promise<Tables<"inventory">> {
  const { data, error } = await supabase
    .from("inventory")
    .update(patch)
    .eq("product_id", productId)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the stock settings");
  if (!data) throw notFoundOrForbidden("Inventory record");

  return data;
}
