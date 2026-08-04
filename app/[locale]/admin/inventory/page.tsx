import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Boxes, PackageX, ShieldQuestion, TriangleAlert } from "lucide-react";

import { InventoryManager } from "@/components/admin/inventory/inventory-manager";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatCard } from "@/components/admin/shared/stat-card";
import { can } from "@/lib/admin/permissions";
import type { Locale } from "@/lib/site-config";
import {
  getAdminSession,
  inventoryMovements,
  inventoryRecords,
} from "@/mocks/admin";
import type { PageParams } from "@/types";
import { formatNumber } from "@/utils/format";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, ["inventory.read", "inventory.adjust"])) notFound();

  const t = await getTranslations("adminInventory");
  const activeLocale = (await getLocale()) as Locale;

  const unitsOnHand = inventoryRecords.reduce(
    (total, record) => total + record.quantityOnHand,
    0,
  );
  const lowStock = inventoryRecords.filter(
    (record) =>
      record.quantityOnHand > 0 &&
      record.quantityOnHand <= record.lowStockThreshold,
  ).length;
  const outOfStock = inventoryRecords.filter(
    (record) => record.quantityOnHand === 0,
  ).length;
  const reserved = inventoryRecords.reduce(
    (total, record) => total + record.quantityReserved,
    0,
  );

  const number = (value: number) => formatNumber(value, activeLocale);

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("stats.unitsOnHand")}
          value={number(unitsOnHand)}
          icon={Boxes}
        />
        <StatCard
          label={t("stats.lowStock")}
          value={number(lowStock)}
          icon={TriangleAlert}
          // Fewer low-stock lines is the good direction, so the trend colour is
          // inverted relative to a plain "up is good" metric.
          invertTrend
        />
        <StatCard
          label={t("stats.outOfStock")}
          value={number(outOfStock)}
          icon={PackageX}
          invertTrend
        />
        <StatCard
          label={t("stats.reserved")}
          value={number(reserved)}
          icon={ShieldQuestion}
          footnote={t("reservedNote")}
        />
      </div>

      <InventoryManager
        records={inventoryRecords}
        movements={inventoryMovements}
        canAdjust={can(permissions, "inventory.adjust")}
      />
    </>
  );
}
