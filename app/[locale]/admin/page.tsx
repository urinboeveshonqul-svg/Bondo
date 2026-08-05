import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { Package, Receipt, TrendingUp } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import {
  StatCard,
  StatisticsCards,
} from "@/components/admin/module/statistics-cards";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/admin/permissions";
import { logger } from "@/lib/logger";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as auditService from "@/services/audit.service";
import * as ordersService from "@/services/orders.service";
import * as productsService from "@/services/products.service";
import type { PageParams } from "@/types";
import type { OrderStatus } from "@/types/admin";
import { formatDate, formatNumber, formatPrice } from "@/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

const ORDER_TONE: Record<
  OrderStatus,
  "success" | "info" | "neutral" | "danger"
> = {
  // `new` is the one that needs somebody to act, so it is the one that stands
  // out; everything mid-pipeline is neutral because it is already in hand.
  new: "info",
  contacted: "neutral",
  confirmed: "neutral",
  preparing: "neutral",
  shipped: "neutral",
  delivered: "success",
  cancelled: "danger",
};

/**
 * Runs one widget's read, degrading to a fallback instead of taking the page.
 *
 * A dashboard is a summary of several independent things. One of them being
 * unreadable — a table that has not been migrated yet, a permission that turns
 * out narrower than the gate assumed — should cost that panel, not the whole
 * screen. The failure is logged at `error`, because an empty widget in
 * production means something is wrong and nothing else on the page will say so.
 *
 * This is the same argument `listNavigationCategories` makes for the category
 * menu, applied per widget.
 */
async function widget<T>(name: string, read: () => Promise<T>, fallback: T) {
  try {
    return await read();
  } catch (error) {
    unstable_rethrow(error);

    logger.error(`[admin] dashboard widget "${name}" failed`, error);

    return fallback;
  }
}

/**
 * Admin dashboard.
 *
 * A Server Component end to end — the tables are markup, and the only
 * JavaScript on this route is the shell's (ADR-6). Widgets gate themselves on
 * permission: a catalog manager sees the product count and no revenue, because
 * `orders.read` is what makes an order figure meaningful and they may not hold
 * it.
 *
 * ## Every number here is real
 *
 * It did not use to be. This page rendered generated revenue and order series,
 * a customer count, a units-on-hand total and two charts, all from
 * `mocks/admin.ts`, under a banner admitting the figures were illustrative. A
 * dashboard whose numbers are decoration is worse than no dashboard: it is the
 * one screen an owner checks to decide something, and a plausible fake number
 * is indistinguishable from a real one until a decision has been made on it.
 *
 * So the rule now is that a figure appears only if a query produces it:
 *
 *  * **Revenue is delivered orders only.** Bondo settles at the door (ADR-63),
 *    so money is taken when an order arrives, not when it is placed.
 *  * **The charts are gone.** Both plotted a thirty-day series that nothing
 *    records. Daily revenue history needs either an orders table with thirty
 *    days in it or a rollup, and the honest thing until then is to draw nothing.
 *  * **The customer count is gone.** It counted `mocks/admin.ts`. Most orders
 *    are placed by guests (ADR-63), so "customers" is not `profiles` either —
 *    it needs a definition before it needs a widget.
 *  * **The units-on-hand and low-stock widgets are gone.** This shop does not
 *    track stock; a published product is orderable.
 *  * **The pending-reviews stat is gone.** It was hardcoded to zero, and there
 *    is no moderation queue for it to count — `product_reviews` only accepts a
 *    row from a delivered buyer, so nothing is pending.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDashboard");
  const activeLocale = (await getLocale()) as Locale;
  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  await guardModule("dashboard", permissions);

  const canSeeOrders = can(permissions, "orders.read");
  const canSeeProducts = can(permissions, "products.read");
  const canSeeAudit = can(permissions, "audit.read");

  const supabase = await createClient();

  // Fetched concurrently, and only what this administrator may read — a query
  // whose result would be hidden is a query not worth issuing.
  const [totals, recentOrders, productCount, activity] = await Promise.all([
    canSeeOrders
      ? widget(
          "orderTotals",
          () => ordersService.getOrderTotals(supabase),
          null,
        )
      : Promise.resolve(null),
    canSeeOrders
      ? widget(
          "recentOrders",
          async () =>
            (
              await ordersService.listOrders(
                supabase,
                {},
                { page: 1, perPage: 7 },
              )
            ).items,
          [],
        )
      : Promise.resolve([]),
    canSeeProducts
      ? widget<number | null>(
          "productCount",
          async () =>
            // `pageSize: 1` because only the count is wanted — the row itself is
            // discarded, and asking for fifty to count them would be waste.
            (
              await productsService.listProducts(supabase, {
                page: 1,
                pageSize: 1,
              })
            ).total,
          null,
        )
      : Promise.resolve(null),
    canSeeAudit
      ? widget(
          "activity",
          async () =>
            (await auditService.listAuditEntries(supabase, { pageSize: 5 }))
              .rows,
          [] as auditService.AuditRow[],
        )
      : Promise.resolve([] as auditService.AuditRow[]),
  ]);

  const money = (cents: number) => formatPrice(cents, activeLocale);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <StatisticsCards>
        {totals ? (
          <>
            <StatCard
              label={t("stats.awaitingContact")}
              value={formatNumber(totals.awaitingContact, activeLocale)}
              icon={Receipt}
              footnote={t("stats.awaitingContactHint")}
            />
            <StatCard
              label={t("stats.orders")}
              value={formatNumber(totals.total, activeLocale)}
              icon={Receipt}
              footnote={t("stats.ordersHint")}
            />
            <StatCard
              label={t("stats.revenue")}
              value={money(totals.deliveredRevenueCents)}
              icon={TrendingUp}
              footnote={t("stats.revenueHint")}
            />
          </>
        ) : null}

        {productCount !== null ? (
          <StatCard
            label={t("stats.products")}
            value={formatNumber(productCount, activeLocale)}
            icon={Package}
            footnote={t("stats.productsHint")}
          />
        ) : null}
      </StatisticsCards>

      {canSeeOrders ? (
        <section
          aria-labelledby="recent-orders"
          className="rounded-xl border bg-card"
        >
          <div className="border-b p-5">
            <h2 id="recent-orders" className="font-semibold tracking-tight">
              {t("recentOrders.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("recentOrders.description")}
            </p>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("recentOrders.emptyTitle")}
              description={t("recentOrders.emptyDescription")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-start font-medium"
                    >
                      {t("recentOrders.reference")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-start font-medium"
                    >
                      {t("recentOrders.customer")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-start font-medium"
                    >
                      {t("recentOrders.status")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-end font-medium"
                    >
                      {t("recentOrders.total")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <th
                        scope="row"
                        className="px-5 py-3 text-start font-mono text-xs font-normal"
                      >
                        {order.reference}
                      </th>
                      <td className="px-5 py-3">
                        <span className="block truncate">
                          {order.customer_name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatDate(order.placed_at, activeLocale)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <ModuleStatusBadge tone={ORDER_TONE[order.status]}>
                          {t(`orderStatus.${order.status}`)}
                        </ModuleStatusBadge>
                      </td>
                      <td className="px-5 py-3 text-end tabular-nums">
                        {money(order.total_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {canSeeAudit ? (
        <section
          aria-labelledby="activity"
          className="rounded-xl border bg-card"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
            <div>
              <h2 id="activity" className="font-semibold tracking-tight">
                {t("activity.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("activity.description")}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.admin.audit}>{t("activity.viewAll")}</Link>
            </Button>
          </div>

          {activity.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("activity.emptyTitle")}
              description={t("activity.emptyDescription")}
            />
          ) : (
            <ul className="divide-y">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {(entry.actor_email ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {entry.actor_email ?? t("activity.systemActor")}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {entry.action}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.resource_type} ·{" "}
                      {formatDate(entry.created_at, activeLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
