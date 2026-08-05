import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { Locale } from "@/lib/site-config";
import type { Paginated, PaginationParams } from "@/types";
import type { Database, Enums, Tables, TablesUpdate } from "@/types/database";

type Client = SupabaseClient<Database>;

export type OrderStatus = Enums<"order_status">;

/** A row of the admin list. Deliberately narrow — the table shows no more. */
export type OrderListRow = Pick<
  Tables<"orders">,
  | "id"
  | "reference"
  | "status"
  | "customer_name"
  | "phone"
  | "telegram"
  | "city"
  | "total_cents"
  | "currency"
  | "locale"
  | "placed_at"
> & {
  /** From an aggregate, not a second query — see `listOrders`. */
  itemCount: number;
};

export type OrderItemRow = Tables<"order_items">;
export type OrderStatusEvent = Tables<"order_status_history">;

export type OrderDetail = Tables<"orders"> & {
  items: OrderItemRow[];
  timeline: OrderStatusEvent[];
};

export type OrderFilters = {
  status?: OrderStatus;
  /** Matched against reference and phone — the two things a caller reads out. */
  search?: string;
  /** ISO dates. Inclusive of `from`, exclusive of the day after `to`. */
  from?: string;
  to?: string;
};

/**
 * Applies the list filters to a query builder.
 *
 * Shared by `listOrders` and `exportOrders` so the CSV an operator downloads is
 * provably the list they were looking at. Two copies of this predicate is how a
 * filtered export quietly ships the whole table.
 */
function applyFilters<T>(query: T, filters: OrderFilters): T {
  // The builder is chainable and returns itself; the cast keeps that fluent
  // shape without spelling out PostgREST's generic soup at every call.
  let q = query as unknown as {
    eq: (column: string, value: unknown) => typeof q;
    or: (filter: string) => typeof q;
    gte: (column: string, value: unknown) => typeof q;
    lt: (column: string, value: unknown) => typeof q;
  };

  if (filters.status) q = q.eq("status", filters.status);

  if (filters.search) {
    // Escaped because a comma or a parenthesis would otherwise terminate the
    // PostgREST filter expression and change which rows come back.
    const term = filters.search.replace(/[,()]/g, " ").trim();

    if (term) q = q.or(`reference.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  if (filters.from) q = q.gte("placed_at", filters.from);

  if (filters.to) {
    // `to` names a day the operator wants included, so the bound is the start of
    // the next one. `lte` on a date would drop everything after midnight.
    const next = new Date(`${filters.to}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    q = q.lt("placed_at", next.toISOString());
  }

  return q as unknown as T;
}

const LIST_COLUMNS = `id, reference, status, customer_name, phone, telegram, city,
   total_cents, currency, locale, placed_at,
   items:order_items ( count )`;

/** PostgREST returns an embedded `count` as `[{ count: n }]`. */
function itemCountOf(row: Record<string, unknown>): number {
  const items = row.items as { count: number }[] | null;

  return items?.[0]?.count ?? 0;
}

/**
 * The admin order list.
 *
 * Filtering, sorting and pagination all happen **in the query** rather than in
 * memory. That is not premature: the in-memory approach the rest of the panel
 * still uses is already recorded as **D-2**, and orders are the one table that
 * grows every day without anybody curating it.
 */
export async function listOrders(
  supabase: Client,
  filters: OrderFilters = {},
  pagination: PaginationParams = { page: 1, perPage: 25 },
): Promise<Paginated<OrderListRow>> {
  const from = (pagination.page - 1) * pagination.perPage;

  const query = applyFilters(
    supabase
      .from("orders")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("placed_at", { ascending: false })
      .range(from, from + pagination.perPage - 1),
    filters,
  );

  const { data, error, count } = await query;
  if (error) throw toAppError(error, "list orders");

  const total = count ?? 0;

  return {
    items: (data ?? []).map((row) => {
      const record = row as unknown as Record<string, unknown>;
      const { items: _items, ...rest } = record;

      return { ...rest, itemCount: itemCountOf(record) } as OrderListRow;
    }),
    page: pagination.page,
    perPage: pagination.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
  };
}

/**
 * One order with everything the detail screen shows.
 *
 * Three embedded selects rather than three round trips: the lines and the
 * timeline are always rendered together with the order, and a detail page that
 * issues a query per panel is a detail page that gets slower every time somebody
 * adds one.
 */
export async function getOrder(
  supabase: Client,
  id: string,
): Promise<OrderDetail> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `*,
       items:order_items ( * ),
       timeline:order_status_history ( * )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw toAppError(error, "load the order");
  if (!data) throw notFoundOrForbidden("Order");

  const order = data as unknown as OrderDetail;

  return {
    ...order,
    // Ordered here rather than in the select: PostgREST cannot order an embedded
    // resource independently of its parent, and both lists are short.
    items: [...order.items].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
    timeline: [...order.timeline].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  };
}

/**
 * Moves an order to a new status.
 *
 * The timeline row is **not** written here. `record_order_status_change` writes
 * it inside the same transaction as the update, so a status can never move
 * without the history recording it — the same argument the inventory ledger
 * makes (ADR-24), applied to a workflow instead of a quantity.
 *
 * `note` is stored on the order's own note field rather than the history row for
 * the same reason: the trigger owns that table, and giving the caller a way to
 * write into it would reopen it.
 */
export async function updateOrderStatus(
  supabase: Client,
  id: string,
  status: OrderStatus,
): Promise<Tables<"orders">> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the order status");
  if (!data) throw notFoundOrForbidden("Order");

  return data;
}

/**
 * The fields an operator fills in during the call.
 *
 * Deliberately narrow. The customer's own details, the lines and the totals a
 * shopper agreed to are not editable here: an order is a record of an agreement,
 * and an interface that lets somebody rewrite what was ordered is one where the
 * record stops being evidence.
 *
 * `deliveryFeeCents` is the exception, and it is the whole point — delivery is
 * quoted per address on the phone. Changing it moves the total, which the
 * `orders_total_is_sum` constraint would otherwise reject, so both are written
 * together.
 */
export async function updateOrderDetails(
  supabase: Client,
  id: string,
  patch: { internalNote?: string | null; deliveryFeeCents?: number },
): Promise<Tables<"orders">> {
  const update: TablesUpdate<"orders"> = {};

  if (patch.internalNote !== undefined) {
    update.internal_note = patch.internalNote;
  }

  if (patch.deliveryFeeCents !== undefined) {
    if (patch.deliveryFeeCents < 0) {
      throw new AppError("validation", "Delivery cannot cost less than zero.");
    }

    const { data: current, error: readError } = await supabase
      .from("orders")
      .select("subtotal_cents")
      .eq("id", id)
      .maybeSingle();

    if (readError) throw toAppError(readError, "load the order");
    if (!current) throw notFoundOrForbidden("Order");

    update.delivery_fee_cents = patch.deliveryFeeCents;
    update.total_cents = current.subtotal_cents + patch.deliveryFeeCents;
  }

  if (Object.keys(update).length === 0) {
    throw new AppError("validation", "Nothing to change.");
  }

  const { data, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw toAppError(error, "update the order");
  if (!data) throw notFoundOrForbidden("Order");

  return data;
}

/**
 * Every order this customer has placed, newest first.
 *
 * Matched on **phone**, not on `user_id`: most orders are placed by guests, so
 * the account is the exception and the number is the identity. An operator
 * looking at an order wants "has this person bought from us before", and the
 * answer has to work for the eighty percent who never registered.
 */
export async function listOrdersByPhone(
  supabase: Client,
  phone: string,
  options: { excludeOrderId?: string; limit?: number } = {},
): Promise<OrderListRow[]> {
  let query = supabase
    .from("orders")
    .select(LIST_COLUMNS)
    .eq("phone", phone)
    .order("placed_at", { ascending: false })
    .limit(options.limit ?? 20);

  if (options.excludeOrderId) query = query.neq("id", options.excludeOrderId);

  const { data, error } = await query;
  if (error) throw toAppError(error, "load the customer's other orders");

  return (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const { items: _items, ...rest } = record;

    return { ...rest, itemCount: itemCountOf(record) } as OrderListRow;
  });
}

/** A signed-in customer's own orders. RLS scopes this to them. */
export async function listMyOrders(
  supabase: Client,
  userId: string,
): Promise<OrderListRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });

  if (error) throw toAppError(error, "load your orders");

  return (data ?? []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const { items: _items, ...rest } = record;

    return { ...rest, itemCount: itemCountOf(record) } as OrderListRow;
  });
}

export type OrderExportRow = {
  reference: string;
  placedAt: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  telegram: string | null;
  city: string | null;
  address: string;
  itemCount: number;
  items: string;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
};

/**
 * The rows behind the export, flattened one per order.
 *
 * Capped rather than unbounded: an export is a spreadsheet somebody opens, and a
 * request that streams the entire table is a request that times out and takes a
 * connection with it. The cap is stated to the operator in the UI.
 */
export const ORDER_EXPORT_LIMIT = 5000;

export async function exportOrders(
  supabase: Client,
  filters: OrderFilters = {},
): Promise<OrderExportRow[]> {
  const query = applyFilters(
    supabase
      .from("orders")
      .select(
        `reference, placed_at, status, customer_name, phone, telegram, city, address,
         subtotal_cents, delivery_fee_cents, total_cents, currency,
         items:order_items ( product_name, sku, quantity )`,
      )
      .order("placed_at", { ascending: false })
      .limit(ORDER_EXPORT_LIMIT),
    filters,
  );

  const { data, error } = await query;
  if (error) throw toAppError(error, "export the orders");

  return (data ?? []).map((row) => {
    const record = row as unknown as Tables<"orders"> & {
      items: { product_name: string; sku: string; quantity: number }[];
    };

    return {
      reference: record.reference,
      placedAt: record.placed_at,
      status: record.status,
      customerName: record.customer_name,
      phone: record.phone,
      telegram: record.telegram,
      city: record.city,
      address: record.address,
      itemCount: record.items.length,
      // One cell, so the spreadsheet stays one row per order. `;` rather than
      // `,` because the file is comma-separated.
      items: record.items
        .map((item) => `${item.quantity}× ${item.product_name} (${item.sku})`)
        .join("; "),
      subtotalCents: record.subtotal_cents,
      deliveryFeeCents: record.delivery_fee_cents,
      totalCents: record.total_cents,
      currency: record.currency,
    };
  });
}

/**
 * Attaches guest orders the caller holds tokens for.
 *
 * Thin wrapper over `claim_orders`, which is where every guard lives: the token
 * must match, the order must still be unowned, and the token is spent on use.
 * Returns how many moved — zero is a normal outcome (nothing held, or already
 * claimed) and not an error.
 */
export async function claimOrders(
  supabase: Client,
  tokens: string[],
): Promise<number> {
  if (tokens.length === 0) return 0;

  const { data, error } = await supabase.rpc("claim_orders", {
    p_tokens: tokens,
  });

  if (error) throw toAppError(error, "attach your earlier orders");

  return data ?? 0;
}

export type OrderTotals = {
  /** Orders at `new` — the ones with a customer waiting for a call. */
  awaitingContact: number;
  total: number;
  /**
   * Money actually taken, in minor units.
   *
   * **Delivered orders only.** Bondo settles at the door (ADR-63), so an order
   * is revenue when it arrives, not when it is placed — counting a `new` order
   * would book money from a phone call nobody has made yet.
   */
  deliveredRevenueCents: number;
  deliveredCount: number;
};

/**
 * The figures the dashboard shows.
 *
 * One query, summed here rather than in Postgres: PostgREST cannot express
 * `sum(total_cents) filter (where status = 'delivered')` without a view or an
 * RPC, and at the volume a single shop's order table reaches this is a few
 * thousand integers. When it is not, this becomes a view and the call site does
 * not change.
 */
export async function getOrderTotals(supabase: Client): Promise<OrderTotals> {
  const { data, error } = await supabase
    .from("orders")
    .select("status, total_cents");

  if (error) throw toAppError(error, "load the order figures");

  const rows = data ?? [];
  const delivered = rows.filter((row) => row.status === "delivered");

  return {
    awaitingContact: rows.filter((row) => row.status === "new").length,
    total: rows.length,
    deliveredRevenueCents: delivered.reduce(
      (sum, row) => sum + row.total_cents,
      0,
    ),
    deliveredCount: delivered.length,
  };
}

/** How many orders sit at each status. Drives the filter chips. */
export async function countOrdersByStatus(
  supabase: Client,
): Promise<Record<OrderStatus, number>> {
  const { data, error } = await supabase.from("orders").select("status");

  if (error) throw toAppError(error, "count the orders");

  const counts = {} as Record<OrderStatus, number>;

  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }

  return counts;
}

export type PlaceOrderInput = {
  customerName: string;
  phone: string;
  address: string;
  telegram?: string | null;
  city?: string | null;
  notes?: string | null;
  locale: Locale;
  items: { productId: string; variantId?: string | null; quantity: number }[];
};

/**
 * Places an order.
 *
 * Calls `place_order`, which is the **only** write path into `orders` — no role
 * holds insert on the table. Everything chargeable is priced inside that
 * function from the live catalog, so nothing in `input` can change what the
 * order costs. A checkout that trusted a client-supplied total is a checkout
 * that sells a laptop for a dollar, and this is where that is prevented.
 */
export async function placeOrder(
  supabase: Client,
  input: PlaceOrderInput,
): Promise<Tables<"orders">> {
  if (input.items.length === 0) {
    throw new AppError("validation", "Your basket is empty.");
  }

  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_address: input.address,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId ?? null,
      quantity: item.quantity,
    })),
    // `undefined` rather than `null`: the generated RPC signature types an
    // omitted argument as absent, and PostgREST then lets the function's own
    // `default null` apply. Sending an explicit null would work too, but only
    // for as long as every one of these keeps its default.
    p_telegram: input.telegram ?? undefined,
    p_city: input.city ?? undefined,
    p_notes: input.notes ?? undefined,
    p_locale: input.locale,
  });

  if (error) {
    // `no_data_found` is the function's signal that a line could not be priced —
    // the product was unpublished or deleted between browsing and checkout. That
    // is a real thing the shopper can act on, so it is not flattened into
    // "something went wrong".
    if (
      error.code === "P0002" ||
      error.message.includes("no longer available")
    ) {
      throw new AppError(
        "conflict",
        "Something in your basket is no longer for sale. Please review it and try again.",
      );
    }

    throw toAppError(error, "place the order");
  }

  if (!data) throw new AppError("internal", "The order was not created.");

  // `returns public.orders` arrives as a single row object, not an array.
  return data as unknown as Tables<"orders">;
}
