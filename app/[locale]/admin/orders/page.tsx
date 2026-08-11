import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, PackageCheck, ShoppingBag, Wallet } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import {
  StatCard,
  StatisticsCards,
} from "@/components/admin/module/statistics-cards";
import { OrdersTable } from "@/components/admin/modules/orders/orders-table";
import { requireAdmin } from "@/lib/auth/guards";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as ordersService from "@/services/orders.service";
import type { PageParams, PageSearchParams } from "@/types";
import { formatNumber, formatPrice } from "@/utils/format";

export const metadata: Metadata = { title: "Orders" };

/**
 * The order queue.
 *
 * ## Why this route exists now and not before
 *
 * The schema, the services and the Server Actions have been in place and
 * verified since `20260809001000_orders_and_reviews.sql`. The **screens** were
 * the gap, and the module was deliberately kept out of the registry until they
 * existed — a sidebar entry pointing at a 404 is worse than an absent one
 * (**D-30**, now closed).
 *
 * ## Filtering happens in the query
 *
 * Status and search go to `listOrders`, which puts them in the PostgREST
 * request. An in-memory filter over the first page would quietly search one
 * page of a growing table and look like it worked.
 */
export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  await guardModule("orders", permissions);

  const t = await getTranslations("adminOrders");
  const activeLocale = (await getLocale()) as Locale;

  const query = await searchParams;
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const status = single(query.status);
  const search = single(query.q)?.trim();
  const page = Number(single(query.page) ?? "1");

  const supabase = await createClient();

  const [orders, totals, byStatus] = await Promise.all([
    ordersService.listOrders(
      supabase,
      {
        ...(status && status !== "all"
          ? { status: status as ordersService.OrderStatus }
          : {}),
        ...(search ? { search } : {}),
      },
      { page: Number.isFinite(page) && page > 0 ? page : 1, perPage: 25 },
    ),
    ordersService.getOrderTotals(supabase),
    ordersService.countOrdersByStatus(supabase),
  ]);

  // "Waiting on a call" is the queue an operator actually works: an order
  // nobody has phoned yet. "Being worked on" is everything between that call
  // and the courier.
  const awaiting = totals.awaitingContact;
  const inProgress =
    (byStatus.contacted ?? 0) +
    (byStatus.confirmed ?? 0) +
    (byStatus.preparing ?? 0) +
    (byStatus.shipped ?? 0);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="orders" permissions={permissions} />

      <StatisticsCards>
        <StatCard
          label={t("stats.total")}
          value={formatNumber(totals.total, activeLocale)}
          icon={ShoppingBag}
        />
        <StatCard
          label={t("stats.awaiting")}
          value={formatNumber(awaiting, activeLocale)}
          icon={Clock}
          invertTrend
        />
        <StatCard
          label={t("stats.inProgress")}
          value={formatNumber(inProgress, activeLocale)}
          icon={PackageCheck}
        />
        <StatCard
          label={t("stats.revenue")}
          value={formatPrice(totals.deliveredRevenueCents, activeLocale)}
          icon={Wallet}
        />
      </StatisticsCards>

      <OrdersTable
        orders={orders.items}
        page={orders.page}
        totalPages={orders.totalPages}
        total={orders.total}
        status={status ?? "all"}
        search={search ?? ""}
      />
    </>
  );
}
