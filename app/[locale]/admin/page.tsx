import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import {
  Boxes,
  MessageSquare,
  Package,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";

import { BarChart, LineChart } from "@/components/admin/module/charts";
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
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import {
  adminCustomers,
  adminOrders,
  adminProducts,
  auditEntries,
  inventoryRecords,
  ordersSeries,
  revenueSeries,
} from "@/mocks/admin";
import type { PageParams } from "@/types";
import type { OrderStatus } from "@/types/admin";
import { percentChange } from "@/utils/admin";
import { formatDate, formatNumber, formatPrice } from "@/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

const ORDER_TONE: Record<
  OrderStatus,
  "success" | "info" | "neutral" | "danger"
> = {
  pending: "info",
  paid: "info",
  fulfilled: "success",
  cancelled: "neutral",
  refunded: "danger",
};

/**
 * Admin dashboard.
 *
 * A Server Component end to end — the charts are SVG, the tables are markup, and
 * the only JavaScript on this route is the shell's (ADR-6). Widgets gate
 * themselves on permission: an inventory manager sees stock and no revenue,
 * because `users.read` is what makes a customer count meaningful and they do
 * not hold it.
 */
export default async function AdminDashboardPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDashboard");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;
  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  await guardModule("dashboard", permissions);

  // Split the series in half to get a comparable previous period, rather than
  // inventing a "last month" figure that nothing produced.
  const half = Math.floor(revenueSeries.length / 2);
  const recent = revenueSeries.slice(half);
  const previous = revenueSeries.slice(0, half);

  const sum = (points: typeof revenueSeries) =>
    points.reduce((total, point) => total + point.value, 0);

  const revenueNow = sum(recent);
  const revenueDelta = percentChange(revenueNow, sum(previous));

  const ordersNow = ordersSeries
    .slice(half)
    .reduce((total, point) => total + point.value, 0);
  const ordersDelta = percentChange(
    ordersNow,
    ordersSeries
      .slice(0, half)
      .reduce((total, point) => total + point.value, 0),
  );

  const lowStock = inventoryRecords
    .filter((record) => record.quantityOnHand <= record.lowStockThreshold)
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand);

  const unitsOnHand = inventoryRecords.reduce(
    (total, record) => total + record.quantityOnHand,
    0,
  );

  const canSeeCommerce = can(permissions, "users.read");
  const canSeeProducts = can(permissions, "products.read");
  const canSeeInventory = can(permissions, "inventory.read");
  const canSeeAudit = can(permissions, "audit.read");

  const money = (cents: number) => formatPrice(cents, activeLocale);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {t("notWired.title")}
        </span>{" "}
        {t("notWired.body")}
      </p>

      <StatisticsCards>
        {canSeeCommerce ? (
          <>
            <StatCard
              label={t("stats.revenue")}
              value={money(revenueNow)}
              icon={TrendingUp}
              deltaPercent={revenueDelta}
              deltaLabel={t("range.vsPrevious")}
            />
            <StatCard
              label={t("stats.orders")}
              value={formatNumber(ordersNow, activeLocale)}
              icon={Receipt}
              deltaPercent={ordersDelta}
              deltaLabel={t("range.vsPrevious")}
            />
          </>
        ) : null}

        {canSeeProducts ? (
          <StatCard
            label={t("stats.products")}
            value={formatNumber(adminProducts.length, activeLocale)}
            icon={Package}
            footnote={t("range.last30")}
          />
        ) : null}

        {canSeeCommerce ? (
          <StatCard
            label={t("stats.customers")}
            value={formatNumber(adminCustomers.length, activeLocale)}
            icon={Users}
            footnote={t("range.last30")}
          />
        ) : null}

        {canSeeInventory ? (
          <StatCard
            label={t("stats.inventoryUnits")}
            value={formatNumber(unitsOnHand, activeLocale)}
            icon={Boxes}
            footnote={t("range.last30")}
          />
        ) : null}

        <StatCard
          label={t("stats.pendingReviews")}
          value={formatNumber(0, activeLocale)}
          icon={MessageSquare}
          footnote={t("pendingReviews.emptyDescription")}
        />
      </StatisticsCards>

      {canSeeCommerce ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="revenue-chart"
            className="rounded-xl border bg-card p-5"
          >
            <h2 id="revenue-chart" className="font-semibold tracking-tight">
              {t("charts.revenueTitle")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("charts.revenueDescription")}
            </p>
            <LineChart
              points={revenueSeries}
              label={`${t("charts.revenueTitle")} — ${t("range.last30")}`}
              dateHeader={t("recentOrders.placed")}
              valueHeader={t("stats.revenue")}
              format={money}
            />
          </section>

          <section
            aria-labelledby="orders-chart"
            className="rounded-xl border bg-card p-5"
          >
            <h2 id="orders-chart" className="font-semibold tracking-tight">
              {t("charts.ordersTitle")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("charts.ordersDescription")}
            </p>
            <BarChart
              points={ordersSeries}
              label={`${t("charts.ordersTitle")} — ${t("range.last30")}`}
              dateHeader={t("recentOrders.placed")}
              valueHeader={t("stats.orders")}
              format={(value) => formatNumber(value, activeLocale)}
            />
          </section>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {canSeeCommerce ? (
          <section
            aria-labelledby="recent-orders"
            className="rounded-xl border bg-card lg:col-span-2"
          >
            <div className="border-b p-5">
              <h2 id="recent-orders" className="font-semibold tracking-tight">
                {t("recentOrders.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("recentOrders.description")}
              </p>
            </div>

            {adminOrders.length === 0 ? (
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
                    {adminOrders.map((order) => (
                      <tr key={order.id}>
                        <th
                          scope="row"
                          className="px-5 py-3 text-start font-mono text-xs font-normal"
                        >
                          {order.reference}
                        </th>
                        <td className="px-5 py-3">
                          <span className="block truncate">
                            {order.customerName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatDate(order.placedAt, activeLocale)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <ModuleStatusBadge tone={ORDER_TONE[order.status]}>
                            {t(`orderStatus.${order.status}`)}
                          </ModuleStatusBadge>
                        </td>
                        <td className="px-5 py-3 text-end tabular-nums">
                          {money(order.totalCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {canSeeInventory ? (
          <section
            aria-labelledby="low-stock"
            className="rounded-xl border bg-card"
          >
            <div className="border-b p-5">
              <h2 id="low-stock" className="font-semibold tracking-tight">
                {t("lowStock.title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("lowStock.description")}
              </p>
            </div>

            {lowStock.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={t("lowStock.emptyTitle")}
                description={t("lowStock.emptyDescription")}
              />
            ) : (
              <>
                <ul className="divide-y">
                  {lowStock.slice(0, 6).map((record) => (
                    <li
                      key={record.productId}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {record.productName}
                        </span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">
                          {record.sku}
                        </span>
                      </span>
                      <ModuleStatusBadge
                        tone={
                          record.quantityOnHand === 0 ? "danger" : "warning"
                        }
                      >
                        {t("lowStock.remaining", {
                          count: formatNumber(
                            record.quantityOnHand,
                            activeLocale,
                          ),
                        })}
                      </ModuleStatusBadge>
                    </li>
                  ))}
                </ul>
                <div className="border-t p-3">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link href={routes.admin.inventory}>
                      {t("lowStock.viewAll")}
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

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

          {auditEntries.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("activity.emptyTitle")}
              description={t("activity.emptyDescription")}
            />
          ) : (
            <ul className="divide-y">
              {auditEntries.slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {entry.actorInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{entry.actorName}</span>{" "}
                      <span className="text-muted-foreground">
                        {entry.summary[activeLocale]}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {entry.entityLabel} ·{" "}
                      {formatDate(entry.createdAt, activeLocale, {
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

      <p className="text-xs text-muted-foreground">{tAdmin("preview.body")}</p>
    </>
  );
}
