import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { Phone, Send } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { OrderWorkflow } from "@/components/admin/modules/orders/order-workflow";
import { requireAdmin } from "@/lib/auth/guards";
import { isAppError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import { statusTone } from "@/utils/admin";
import * as ordersService from "@/services/orders.service";
import type { PageParams } from "@/types";
import { formatDate, formatPrice } from "@/utils/format";

export const metadata: Metadata = { title: "Order" };

/**
 * One order, and everything needed to act on it.
 *
 * The layout is deliberate: contact details first, because the operator's next
 * move is a phone call. Then what was ordered, then the workflow controls, then
 * the history. A screen that opens on a line-item table makes somebody scroll
 * to find the number they came here to dial.
 *
 * **`notFound()` on a missing or forbidden order.** `getOrder` throws
 * `not_found` for both — RLS returns no row to an operator without
 * `orders.read`, exactly as it does for an id that does not exist — and the two
 * are deliberately indistinguishable from outside (ADR-4).
 */
export default async function AdminOrderPage({
  params,
}: {
  params: PageParams<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("orders", permissions);

  const t = await getTranslations("adminOrders");
  const activeLocale = (await getLocale()) as Locale;

  const supabase = await createClient();
  const order = await ordersService.getOrder(supabase, id).catch((error) => {
    unstable_rethrow(error);
    if (isAppError(error) && error.code === "not_found") return null;
    throw error;
  });

  if (!order) notFound();

  const telegram = order.telegram?.replace(/^@/, "");
  const fullName =
    [order.first_name, order.last_name].filter(Boolean).join(" ") ||
    order.customer_name;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[
          { label: t("title"), href: routes.admin.orders },
          { label: order.reference },
        ]}
        title={order.reference}
        description={`${t("detail.placedAt")}: ${formatDate(
          order.placed_at,
          activeLocale,
          {
            dateStyle: "long",
            timeStyle: "short",
          },
        )}`}
        actions={
          <ModuleStatusBadge tone={statusTone(order.status)}>
            {t(`status.${order.status}`)}
          </ModuleStatusBadge>
        }
      />

      <ModuleReadOnlyNotice id="orders" permissions={permissions} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title={t("detail.contactTitle")}>
            <Field label={t("detail.customer")} value={fullName} />

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {t("detail.phonePrimary")}
              </p>
              <a
                href={`tel:${order.phone.replace(/\s/g, "")}`}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline lg:min-h-0"
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {order.phone}
              </a>
            </div>

            {order.phone_secondary ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("detail.phoneSecondary")}
                </p>
                <a
                  href={`tel:${order.phone_secondary.replace(/\s/g, "")}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline lg:min-h-0"
                >
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {order.phone_secondary}
                </a>
              </div>
            ) : null}

            {telegram ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("detail.telegram")}
                </p>
                <a
                  href={`https://t.me/${telegram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline lg:min-h-0"
                >
                  <Send className="size-4 shrink-0" aria-hidden="true" />
                  {t("detail.openTelegram")}
                </a>
              </div>
            ) : null}

            {order.email ? (
              <Field label={t("detail.email")} value={order.email} />
            ) : null}

            <p className="text-xs text-muted-foreground">
              {order.user_id
                ? t("detail.linkedAccount")
                : t("detail.guestOrder")}
            </p>
          </Panel>

          <Panel title={t("detail.deliveryTitle")}>
            <Field
              label={t("detail.method")}
              value={t(`delivery.${order.delivery_method}`)}
            />
            {order.delivery_method === "pickup" ? (
              <Field
                label={t("detail.pickupLocation")}
                value={order.pickup_location ?? order.address}
              />
            ) : (
              <Field label={t("detail.address")} value={order.address} />
            )}
            {order.region ? (
              <Field label={t("detail.region")} value={order.region} />
            ) : null}
            {order.city ? (
              <Field label={t("detail.city")} value={order.city} />
            ) : null}
          </Panel>

          <Panel title={t("detail.itemsTitle")}>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku} · {t("detail.quantity")} {item.quantity} ·{" "}
                      {formatPrice(item.unit_price_cents, activeLocale)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatPrice(item.line_total_cents, activeLocale)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1.5 border-t pt-3 text-sm">
              <Row
                label={t("detail.subtotal")}
                value={formatPrice(order.subtotal_cents, activeLocale)}
              />
              <Row
                label={t("detail.deliveryFee")}
                value={formatPrice(order.delivery_fee_cents, activeLocale)}
              />
              <Row
                label={t("detail.total")}
                value={formatPrice(order.total_cents, activeLocale)}
                emphasis
              />
            </dl>
          </Panel>

          <Panel title={t("detail.customerNote")}>
            <p className="text-sm text-pretty">
              {order.notes?.trim() || (
                <span className="text-muted-foreground">
                  {t("detail.noCustomerNote")}
                </span>
              )}
            </p>
          </Panel>
        </div>

        <div className="space-y-6">
          <OrderWorkflow
            orderId={order.id}
            status={order.status}
            internalNote={order.internal_note}
            canUpdate={capabilities.update}
          />

          <Panel title={t("detail.timelineTitle")}>
            {order.timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("detail.timelineEmpty")}
              </p>
            ) : (
              <ol className="space-y-3">
                {order.timeline.map((event) => (
                  <li key={event.id} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {t(`status.${event.to_status}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(event.created_at, activeLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {/* Who moved it, when the trigger captured a name. The
                          column is denormalised on purpose: an admin who later
                          leaves must not erase the history of what they did. */}
                      {event.changed_by_name
                        ? ` · ${event.changed_by_name}`
                        : ""}
                    </span>
                    {event.note ? (
                      <span className="text-xs text-muted-foreground">
                        {event.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-pretty">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={emphasis ? "font-medium" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={`tabular-nums ${emphasis ? "font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
