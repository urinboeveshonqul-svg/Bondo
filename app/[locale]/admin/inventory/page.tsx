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
import { requireAdmin } from "@/lib/auth/guards";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as inventoryService from "@/services/inventory.service";
import type { InventoryMovement, InventoryRecord } from "@/types/admin";
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

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("inventory", permissions);

  const t = await getTranslations("adminInventory");
  const activeLocale = (await getLocale()) as Locale;

  /*
    Read with the operator's own session so RLS decides what comes back, and in
    parallel because neither read depends on the other. The movement ledger is
    capped at 100: it grows without bound and nobody scrolls a stock history
    past the last few weeks — the full record stays queryable per product.
  */
  const supabase = await createClient();
  const [levels, movementRows] = await Promise.all([
    inventoryService.listInventory(supabase),
    inventoryService.listMovements(supabase, { limit: 100 }),
  ]);

  const records: InventoryRecord[] = levels.map((level) => ({
    productId: level.product_id,
    productName: level.product?.name[activeLocale] ?? level.product?.sku ?? "—",
    sku: level.product?.sku ?? "—",
    // The listing has no brand join, and inventing one would mean a second
    // query per row for a column nobody sorts by.
    brand: "",
    quantityOnHand: level.quantity_on_hand,
    quantityReserved: level.quantity_reserved,
    lowStockThreshold: level.low_stock_threshold,
  }));

  const movements: InventoryMovement[] = movementRows.map((movement) => ({
    id: movement.id,
    productId: movement.product_id,
    productName:
      movement.product?.name[activeLocale] ?? movement.product?.sku ?? "—",
    sku: movement.product?.sku ?? "—",
    reason: movement.movement_type,
    quantityDelta: movement.quantity_delta,
    quantityAfter: movement.quantity_after,
    note: movement.reason,
    // `created_by` is a uuid and the panel has no name for it without a join
    // through profiles that RLS may refuse. The audit log is where "who" is
    // answered; this column shows it only when the ledger already knows.
    createdBy: movement.created_by ?? "—",
    createdAt: movement.created_at,
  }));

  const unitsOnHand = records.reduce(
    (total, record) => total + record.quantityOnHand,
    0,
  );
  const lowStock = records.filter(
    (record) =>
      record.quantityOnHand > 0 &&
      record.quantityOnHand <= record.lowStockThreshold,
  ).length;
  const outOfStock = records.filter(
    (record) => record.quantityOnHand === 0,
  ).length;
  const reserved = records.reduce(
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
        records={records}
        movements={movements}
        capabilities={capabilities}
      />
    </>
  );
}
