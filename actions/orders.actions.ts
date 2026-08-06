"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { requirePermission } from "@/lib/admin/action-guard";
import { rememberClaimToken } from "@/lib/orders/claim-cookie";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as ordersService from "@/services/orders.service";

/**
 * Order entry points.
 *
 * Two audiences with opposite trust levels meet in this file, so it is worth
 * being explicit about which is which:
 *
 *  - **`placeOrder` is reachable by anybody**, signed in or not. That is the
 *    business requirement — a shopper who has to register before we ring them
 *    has already gone elsewhere — and it is safe because the action cannot
 *    influence what an order costs. Prices are read inside `place_order()`,
 *    which is the only writer into `orders`; nothing in this file's input
 *    reaches a price column.
 *  - **Everything else is staff-only**, and each one calls `requirePermission`
 *    first. The guard is defence in depth, not the boundary: RLS
 *    refuses the write regardless (ADR-4), and an action that forgot the guard
 *    would return an error rather than perform the change.
 */

// -----------------------------------------------------------------------------
// Storefront
// -----------------------------------------------------------------------------

/**
 * Uzbek mobile numbers, in the shapes people actually type them.
 *
 * Accepts `+998901234567`, `998901234567`, `901234567` and any of those with
 * spaces, dashes or parentheses — then normalises. Rejecting a real customer
 * because they typed their own number the way they always do is a worse failure
 * than storing an unusual format.
 */
const PHONE_PATTERN =
  /^(?:\+?998)?\s*\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;

/** `+998 90 123 45 67` in every shape → `+998901234567`. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("998") ? digits.slice(3) : digits;

  return `+998${national}`;
}

const phoneSchema = z
  .string()
  .trim()
  .min(7, "checkout.errors.phoneRequired")
  .refine((value) => PHONE_PATTERN.test(value), "checkout.errors.phoneInvalid")
  .transform(normalizePhone);

/**
 * A Telegram handle, with or without the `@`.
 *
 * Stored with the `@` so an operator can copy it straight into the app. Telegram
 * itself requires 5–32 characters, letters, digits and underscores.
 */
const telegramSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .refine(
    (value) => value === "" || /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value),
    "checkout.errors.telegramInvalid",
  )
  .transform((value) => (value === "" ? null : `@${value}`));

const basketItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullish(),
  // Bounded to match `order_items_quantity_sane`. Validating it here as well
  // turns a fat-fingered quantity into a field error on the form rather than a
  // constraint violation the shopper cannot interpret.
  quantity: z.number().int().min(1).max(100),
});

/**
 * The checkout payload.
 *
 * `superRefine` rather than two schemas, because the two fulfilment paths differ by
 * exactly one required field and everything else is identical. Splitting them
 * would duplicate eleven rules to vary one.
 */
const checkoutSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "checkout.errors.firstNameRequired")
      .max(60, "checkout.errors.nameTooLong"),
    lastName: z
      .string()
      .trim()
      .min(2, "checkout.errors.lastNameRequired")
      .max(60, "checkout.errors.nameTooLong"),
    phone: phoneSchema,
    // Optional, and normalised the same way when present — a second number
    // stored in a different shape is a second number nobody can search for.
    phoneSecondary: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullish()
      .refine(
        (value) => value == null || PHONE_PATTERN.test(value),
        "checkout.errors.phoneInvalid",
      )
      .transform((value) => (value == null ? null : normalizePhone(value))),
    telegram: telegramSchema.nullish(),
    // **Optional, and it stays optional.** Checkout must not start demanding an
    // email: this shop rings people, and a required field nobody reads costs
    // orders (ADR-63). It is here only so a guest who leaves one can be
    // reunited with the order after verifying it (ADR-71).
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((value) => (value === "" ? null : value))
      .nullish()
      .refine(
        (value) => value == null || /^[^@s]+@[^@s]+.[^@s]+$/.test(value),
        "checkout.errors.emailInvalid",
      ),
    region: z.string().trim().min(2, "checkout.errors.regionRequired").max(120),
    city: z.string().trim().min(2, "checkout.errors.cityRequired").max(120),
    deliveryMethod: z.enum(["delivery", "pickup"]),
    address: z.string().trim().max(500).optional(),
    pickupLocation: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).nullish(),
    locale: z.enum(locales),
    items: z
      .array(basketItemSchema)
      .min(1, "checkout.errors.basketEmpty")
      .max(50, "checkout.errors.basketTooLarge"),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMethod === "delivery") {
      if (!value.address || value.address.length < 5) {
        ctx.addIssue({
          code: "custom",
          path: ["address"],
          message: "checkout.errors.addressRequired",
        });
      }
    } else if (!value.pickupLocation || value.pickupLocation.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["pickupLocation"],
        message: "checkout.errors.pickupRequired",
      });
    }
  });

export const placeOrder = createAction(
  "placeOrder",
  checkoutSchema,
  async (input) => {
    const supabase = await createClient();

    // `orders.address` is NOT NULL from the original migration, so a pickup
    // stores the shop there as well as in `pickup_location`. That keeps every
    // existing reader — the admin list, the CSV export, the order detail — from
    // needing to learn about a second "where does this go" column.
    const address =
      input.deliveryMethod === "delivery"
        ? (input.address ?? "")
        : (input.pickupLocation ?? "");

    const order = await ordersService.placeOrder(supabase, {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      phoneSecondary: input.phoneSecondary ?? null,
      telegram: input.telegram ?? null,
      email: input.email ?? null,
      region: input.region,
      city: input.city,
      deliveryMethod: input.deliveryMethod,
      address,
      pickupLocation:
        input.deliveryMethod === "pickup"
          ? (input.pickupLocation ?? null)
          : null,
      notes: input.notes ?? null,
      locale: input.locale,
      items: input.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
      })),
    });

    // A guest order comes back with a single-use claim token (ADR-70). It is
    // stored in an httpOnly cookie and **never returned to the browser**: the
    // token is a capability, and a capability in a response body ends up in a
    // log, an analytics payload or a screenshot. The confirmation page needs to
    // know only that a claim is pending, which it reads from the cookie
    // server-side.
    if (order.claim_token) {
      await rememberClaimToken(order.claim_token);
    }

    // Only the reference crosses back. The order row carries the customer's
    // address and phone, and there is no reason for any of it to travel to a
    // browser that already knows what it typed.
    return { reference: order.reference };
  },
);

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

/**
 * Revalidates the two places an order is rendered.
 *
 * `revalidatePath` needs the locale segment, and an order moved in Russian must
 * still look moved in Uzbek — so all three are invalidated rather than only the
 * one the operator happened to be using.
 */
function revalidateOrder(id: string): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}${routes.admin.orders}`);
    revalidatePath(`/${locale}${routes.admin.order(id)}`);
  }
}

export const updateOrderStatus = createAction(
  "updateOrderStatus",
  z.object({
    id: z.uuid(),
    status: z.enum([
      "new",
      "contacted",
      "confirmed",
      "preparing",
      "shipped",
      "delivered",
      "cancelled",
    ]),
  }),
  async (input) => {
    // Throws if the caller is not an active admin holding `orders.update`.
    await requirePermission("orders.update");

    const supabase = await createClient();
    const order = await ordersService.updateOrderStatus(
      supabase,
      input.id,
      input.status,
    );

    revalidateOrder(input.id);

    return { status: order.status };
  },
);

/**
 * Hoisted out of the `createAction` call on purpose.
 *
 * A `"use server"` module is compiled with the rule that every top-level
 * function is a Server Action and must be async — and SWC applies that to
 * *every* function expression in an exported initializer, including the arrow
 * passed to `.refine()`. Inlining this schema made the build fail with
 * "Server Actions must be async functions" pointing at the predicate.
 *
 * Declaring the schema separately puts the arrow in a non-exported const, where
 * the rule does not reach. Every other schema in this codebase is written this
 * way; this one was the exception and it is why.
 */
const updateOrderDetailsSchema = z
  .object({
    id: z.uuid(),
    internalNote: z.string().trim().max(2000).nullish(),
    // Minor units (ADR-2). The form sends whole currency units and converts;
    // accepting a float here would land a rounding error in a total.
    deliveryFeeCents: z.number().int().min(0).max(100_000_000).optional(),
  })
  .refine(
    (value) =>
      value.internalNote !== undefined || value.deliveryFeeCents !== undefined,
    "orders.errors.nothingToChange",
  );

export const updateOrderDetails = createAction(
  "updateOrderDetails",
  updateOrderDetailsSchema,
  async (input) => {
    await requirePermission("orders.update");

    const supabase = await createClient();
    const order = await ordersService.updateOrderDetails(supabase, input.id, {
      ...(input.internalNote !== undefined
        ? { internalNote: input.internalNote ?? null }
        : {}),
      ...(input.deliveryFeeCents !== undefined
        ? { deliveryFeeCents: input.deliveryFeeCents }
        : {}),
    });

    revalidateOrder(input.id);

    return {
      deliveryFeeCents: order.delivery_fee_cents,
      totalCents: order.total_cents,
    };
  },
);

/**
 * Builds the CSV an operator downloads.
 *
 * Generated server-side rather than assembled in the browser from the rendered
 * table: the table is one page of results, and an export that silently covered
 * only what was on screen would be worse than no export.
 */
export const exportOrders = createAction(
  "exportOrders",
  z.object({
    status: z
      .enum([
        "new",
        "contacted",
        "confirmed",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
      ])
      .optional(),
    search: z.string().trim().max(120).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }),
  async (input) => {
    await requirePermission("orders.read");

    const supabase = await createClient();
    const rows = await ordersService.exportOrders(supabase, input);

    return {
      rows,
      /** True when the cap trimmed the result, so the UI can say so. */
      truncated: rows.length === ordersService.ORDER_EXPORT_LIMIT,
    };
  },
);

/**
 * A customer's other orders, looked up by phone.
 *
 * Its own action rather than part of the detail page's data because it is opened
 * on demand: most orders are looked at without anybody asking "who is this",
 * and loading every customer's history on every detail render would be a join
 * nobody reads.
 */
export const loadCustomerHistory = createAction(
  "loadCustomerHistory",
  z.object({ orderId: z.uuid(), phone: z.string().trim().min(7).max(32) }),
  async (input) => {
    await requirePermission("orders.read");

    const supabase = await createClient();
    const orders = await ordersService.listOrdersByPhone(
      supabase,
      input.phone,
      {
        excludeOrderId: input.orderId,
      },
    );

    return { orders };
  },
);
