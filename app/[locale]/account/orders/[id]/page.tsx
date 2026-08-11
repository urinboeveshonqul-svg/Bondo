import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Check, ChevronLeft, Circle } from "lucide-react";

import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/guards";
import { canReviewOrder, orderTimeline } from "@/lib/orders/status";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as ordersService from "@/services/orders.service";
import * as reviewsService from "@/services/reviews.service";
import { OrderReviewPanel } from "@/components/account/order-review-panel";
import type { PageParams } from "@/types";
import { formatDate, formatPrice } from "@/utils/format";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

/**
 * One order, as its customer sees it.
 *
 * **The 404 is RLS doing its job.** `getOrder` throws `not_found` when the
 * policy returns no row, which is the same answer somebody gets for an id that
 * does not exist — so a customer probing for another customer's order learns
 * nothing from the difference.
 *
 * "Leave a review" appears only on a delivered order. The button's absence is a
 * convenience; the guarantee is the RLS policy behind the insert, which checks
 * the same three facts independently (ADR-66).
 */
export default async function AccountOrderPage({
  params,
}: {
  params: PageParams<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireUser(routes.account.order(id));
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("account.orderDetail");
  const tReviews = await getTranslations("account.reviews");
  const tStatus = await getTranslations("account.orderStatus");
  const tList = await getTranslations("account.orders");

  const supabase = await createClient();

  const order = await ordersService.getOrder(supabase, id).catch(() => null);
  if (!order) notFound();

  const timeline = orderTimeline(order.status);
  const canReview = canReviewOrder(order.status);

  /*
    What is still reviewable on *this* order.

    `listReviewableProducts` answers for every delivered order and already
    excludes products this customer has reviewed, so filtering it by order id
    gives the lines to offer here. It runs under the customer's own session, so
    RLS decides what it can see — and the insert is gated independently by the
    policy on `product_reviews` (ADR-66) whatever this returns.
  */
  const reviewable = canReview
    ? (await reviewsService.listReviewableProducts(supabase, activeLocale))
        .filter((item) => item.orderId === order.id)
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          orderId: item.orderId,
        }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2 mb-2">
          <Link href={routes.account.orders}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-mono text-xl font-semibold tracking-tight">
              {order.reference}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.placed_at, activeLocale, {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* What the status means, in a sentence. A badge alone tells somebody the
          word we use internally; this tells them what is happening. */}
      <p className="rounded-lg border bg-card p-4 text-sm text-pretty">
        {tStatus(`${order.status}.body`)}
      </p>

      {timeline ? (
        <section
          aria-labelledby="timeline"
          className="rounded-xl border bg-card p-5"
        >
          <h2 id="timeline" className="mb-4 font-semibold tracking-tight">
            {t("timeline")}
          </h2>

          <ol className="space-y-0">
            {timeline.map((step, index) => (
              <li key={step.status} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border",
                      step.state === "done" &&
                        "border-primary bg-primary text-primary-foreground",
                      step.state === "current" && "border-primary text-primary",
                      step.state === "upcoming" &&
                        "border-muted-foreground/30 text-muted-foreground/30",
                    )}
                  >
                    {step.state === "done" ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Circle
                        className="size-2 fill-current"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {index < timeline.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "w-px flex-1",
                        step.state === "done" ? "bg-primary" : "bg-border",
                      )}
                    />
                  ) : null}
                </div>

                <div
                  className={cn(
                    "min-w-0 pb-5",
                    index === timeline.length - 1 && "pb-0",
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {tStatus(`${step.status}.label`)}
                    {step.state === "current" ? (
                      <span className="sr-only"> — {t("currentStep")}</span>
                    ) : null}
                  </p>
                  {step.state === "current" ? (
                    <p className="text-xs text-pretty text-muted-foreground">
                      {tStatus(`${step.status}.body`)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="items" className="rounded-xl border bg-card">
        <h2 id="items" className="border-b p-5 font-semibold tracking-tight">
          {t("items")}
        </h2>

        <ul className="divide-y">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-start justify-between gap-3 p-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.product_name}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {item.sku}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {formatPrice(item.unit_price_cents, activeLocale)} ×{" "}
                  {item.quantity}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-medium tabular-nums">
                  {formatPrice(item.line_total_cents, activeLocale)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd className="tabular-nums">
              {formatPrice(order.subtotal_cents, activeLocale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("delivery")}</dt>
            <dd className="tabular-nums">
              {order.delivery_fee_cents === 0
                ? t("deliveryPending")
                : formatPrice(order.delivery_fee_cents, activeLocale)}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-medium">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">
              {formatPrice(order.total_cents, activeLocale)}
            </dd>
          </div>
        </dl>
      </section>

      {canReview ? (
        <section
          aria-labelledby="order-reviews"
          className="space-y-3 rounded-xl border bg-card p-5"
        >
          <div>
            <h2 id="order-reviews" className="text-sm font-medium">
              {tReviews("title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {tReviews("description")}
            </p>
          </div>
          <OrderReviewPanel lines={reviewable} />
        </section>
      ) : null}

      <section
        aria-labelledby="delivery-details"
        className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
      >
        <h2 id="delivery-details" className="sr-only">
          {t("deliveryDetails")}
        </h2>

        <Detail
          label={tList(`deliveryMethod.${order.delivery_method}`)}
          value={
            order.delivery_method === "pickup"
              ? (order.pickup_location ?? order.address)
              : order.address
          }
        />
        <Detail
          label={t("area")}
          value={[order.region, order.city].filter(Boolean).join(", ") || "—"}
        />
        <Detail label={t("contact")} value={order.customer_name} />
        <Detail
          label={t("phone")}
          value={[order.phone, order.phone_secondary]
            .filter(Boolean)
            .join(" · ")}
        />
        {order.telegram ? (
          <Detail label="Telegram" value={order.telegram} />
        ) : null}
        {order.notes ? <Detail label={t("notes")} value={order.notes} /> : null}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value}</p>
    </div>
  );
}
