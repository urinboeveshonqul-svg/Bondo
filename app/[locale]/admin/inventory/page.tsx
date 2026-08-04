import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Boxes, PackageX, ShieldQuestion, TriangleAlert } from "lucide-react";

import { InventoryManager } from "@/components/admin/modules/inventory/inventory-manager";
import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import {
  StatCard,
  StatisticsCards,
} from "@/components/admin/module/statistics-cards";
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
  const capabilities = await guardModule("inventory", permissions);

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
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="inventory" permissions={permissions} />

      <StatisticsCards>
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
      </StatisticsCards>

      <InventoryManager
        records={inventoryRecords}
        movements={inventoryMovements}
        capabilities={capabilities}
      />
    </>
  );
}
