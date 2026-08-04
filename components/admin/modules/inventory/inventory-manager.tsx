"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import {
  ModuleStatusBadge,
  type ModuleStatusTone,
} from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { Locale } from "@/lib/site-config";
import type {
  InventoryMovement,
  InventoryRecord,
  MovementReason,
} from "@/types/admin";
import { formatDate, formatNumber } from "@/utils/format";

/**
 * Inventory: current levels and the ledger that produced them.
 *
 * The two tabs are the whole model. `inventory.quantity_on_hand` is derived from
 * `inventory_movements`, and a trigger rejects any other write to it (ADR-27) —
 * so the adjustment dialog records a **movement**, never a new total. That is
 * why it asks for a delta and a reason rather than "new quantity": the reason is
 * the audit trail, and a bare overwrite destroys it.
 *
 * `quantityReserved` is shown but always zero. It is declared in the schema and
 * nothing writes it until checkout lands (**D-10**); showing it now with a note
 * is more honest than hiding a column that will appear later.
 */
/**
 * Reasons an operator may choose.
 *
 * `sale` is excluded deliberately — it is written by checkout, not by hand — but
 * the list is otherwise the database enum. It previously offered `damage` and
 * `recount`, neither of which exists, so the insert would have been rejected
 * after the operator filled in the form (**K-16**). A write-off is now
 * `adjustment` and a miscount is `correction`, which is what the schema calls
 * them.
 */
const REASONS: readonly MovementReason[] = [
  "purchase",
  "return",
  "adjustment",
  "correction",
];

function stockTone(record: InventoryRecord): ModuleStatusTone {
  if (record.quantityOnHand === 0) return "danger";
  if (record.quantityOnHand <= record.lowStockThreshold) return "warning";
  return "success";
}

export function InventoryManager({
  records,
  movements,
  capabilities,
}: {
  records: readonly InventoryRecord[];
  movements: readonly InventoryMovement[];
  capabilities: ModuleCapabilities;
}) {
  // Stock is never created or deleted, only moved (ADR-24), so the module has
  // exactly one mutating capability and this is it.
  const canAdjust = capabilities.update;
  const t = useTranslations("adminInventory");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [adjusting, setAdjusting] = useState<InventoryRecord | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<MovementReason>("purchase");
  const [note, setNote] = useState("");

  const number = (value: number) => formatNumber(value, locale);

  const levelColumns: ModuleTableColumn<InventoryRecord>[] = [
    {
      id: "product",
      header: t("levels.columns.product"),
      sortValue: (record) => record.productName,
      cell: (record) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {record.productName}
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {record.sku}
          </span>
        </span>
      ),
    },
    {
      id: "onHand",
      header: t("levels.columns.onHand"),
      align: "end",
      sortValue: (record) => record.quantityOnHand,
      cell: (record) => (
        <span className="tabular-nums">{number(record.quantityOnHand)}</span>
      ),
    },
    {
      id: "reserved",
      header: t("levels.columns.reserved"),
      align: "end",
      hideOnMobile: true,
      sortValue: (record) => record.quantityReserved,
      cell: (record) => (
        <span className="text-muted-foreground tabular-nums">
          {number(record.quantityReserved)}
        </span>
      ),
    },
    {
      id: "available",
      header: t("levels.columns.available"),
      align: "end",
      hideOnMobile: true,
      sortValue: (record) => record.quantityOnHand - record.quantityReserved,
      cell: (record) => (
        <span className="tabular-nums">
          {number(record.quantityOnHand - record.quantityReserved)}
        </span>
      ),
    },
    {
      id: "threshold",
      header: t("levels.columns.threshold"),
      align: "end",
      hideOnMobile: true,
      cell: (record) => (
        <span className="text-muted-foreground tabular-nums">
          {number(record.lowStockThreshold)}
        </span>
      ),
    },
    {
      id: "state",
      header: t("levels.columns.state"),
      cell: (record) => {
        const tone = stockTone(record);

        return (
          <ModuleStatusBadge tone={tone}>
            {tone === "danger"
              ? t("levels.filters.out")
              : tone === "warning"
                ? t("levels.filters.low")
                : t("levels.filters.healthy")}
          </ModuleStatusBadge>
        );
      },
    },
  ];

  const movementColumns: ModuleTableColumn<InventoryMovement>[] = [
    {
      id: "when",
      header: t("movements.columns.when"),
      sortValue: (movement) => movement.createdAt,
      cell: (movement) => (
        <span className="text-xs whitespace-nowrap">
          {formatDate(movement.createdAt, locale, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      ),
    },
    {
      id: "product",
      header: t("movements.columns.product"),
      sortValue: (movement) => movement.productName,
      cell: (movement) => (
        <span className="min-w-0">
          <span className="block truncate font-medium">
            {movement.productName}
          </span>
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {movement.sku}
          </span>
        </span>
      ),
    },
    {
      id: "reason",
      header: t("movements.columns.reason"),
      cell: (movement) => (
        <ModuleStatusBadge
          tone={movement.quantityDelta > 0 ? "success" : "neutral"}
        >
          {t(`reasons.${movement.reason}`)}
        </ModuleStatusBadge>
      ),
    },
    {
      id: "change",
      header: t("movements.columns.change"),
      align: "end",
      sortValue: (movement) => movement.quantityDelta,
      cell: (movement) => (
        <span
          className={
            movement.quantityDelta > 0
              ? "font-medium text-success tabular-nums"
              : "font-medium text-destructive tabular-nums"
          }
        >
          {movement.quantityDelta > 0 ? "+" : ""}
          {number(movement.quantityDelta)}
        </span>
      ),
    },
    {
      id: "after",
      header: t("movements.columns.after"),
      align: "end",
      hideOnMobile: true,
      cell: (movement) => (
        <span className="tabular-nums">{number(movement.quantityAfter)}</span>
      ),
    },
    {
      id: "by",
      header: t("movements.columns.by"),
      hideOnMobile: true,
      cell: (movement) => (
        <span className="min-w-0">
          <span className="block truncate text-sm">{movement.createdBy}</span>
          {movement.note ? (
            <span className="block truncate text-xs text-muted-foreground">
              {movement.note}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels">{t("tabs.levels")}</TabsTrigger>
          <TabsTrigger value="movements">{t("tabs.movements")}</TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="mt-4">
          <ModuleTable
            rows={records}
            columns={levelColumns}
            getRowId={(record) => record.productId}
            searchIn={(record) => `${record.productName} ${record.sku}`}
            searchPlaceholder={t("levels.searchPlaceholder")}
            initialSort={{ columnId: "onHand", direction: "asc" }}
            filters={[
              {
                id: "state",
                label: t("levels.filters.state"),
                options: [
                  { value: "out", label: t("levels.filters.out") },
                  { value: "low", label: t("levels.filters.low") },
                  { value: "healthy", label: t("levels.filters.healthy") },
                ],
                match: (record, value) => {
                  const tone = stockTone(record);
                  if (value === "out") return tone === "danger";
                  if (value === "low") return tone === "warning";
                  return tone === "success";
                },
              },
            ]}
            rowActions={(record) =>
              canAdjust ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAdjusting(record);
                    setDelta(0);
                    setReason("purchase");
                    setNote("");
                  }}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  {t("levels.adjust")}
                </Button>
              ) : null
            }
            emptyTitle={t("levels.emptyTitle")}
            emptyDescription={t("levels.emptyDescription")}
          />
        </TabsContent>

        <TabsContent value="movements" className="mt-4 space-y-3">
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t("movements.appendOnly")}
          </p>

          <ModuleTable
            rows={movements}
            columns={movementColumns}
            getRowId={(movement) => movement.id}
            searchIn={(movement) =>
              `${movement.productName} ${movement.sku} ${movement.createdBy} ${movement.note ?? ""}`
            }
            initialSort={{ columnId: "when", direction: "desc" }}
            emptyTitle={t("movements.emptyTitle")}
            emptyDescription={t("movements.emptyDescription")}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={adjusting !== null}
        onOpenChange={(open) => !open && setAdjusting(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {adjusting ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("adjustDialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("adjustDialog.description", {
                    product: adjusting.productName,
                  })}
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAdjusting(null);
                  toast(tAdmin("notSaved.title"), {
                    description: tAdmin("notSaved.body"),
                  });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="adjust-reason">
                    {t("adjustDialog.reason")}
                  </Label>
                  <Select
                    value={reason}
                    onValueChange={(value) =>
                      setReason(value as MovementReason)
                    }
                  >
                    <SelectTrigger id="adjust-reason">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`reasons.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adjust-quantity">
                    {t("adjustDialog.quantity")}
                  </Label>
                  <Input
                    id="adjust-quantity"
                    type="number"
                    value={delta}
                    onChange={(event) =>
                      setDelta(Number(event.target.value) || 0)
                    }
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("adjustDialog.quantityHint")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adjust-note">{t("adjustDialog.note")}</Label>
                  <Textarea
                    id="adjust-note"
                    rows={3}
                    value={note}
                    placeholder={t("adjustDialog.notePlaceholder")}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>

                <div
                  role="status"
                  className="rounded-lg border bg-muted/50 px-3 py-2 text-sm"
                >
                  <p className="text-muted-foreground">
                    {t("adjustDialog.current", {
                      count: number(adjusting.quantityOnHand),
                    })}
                  </p>
                  <p className="font-medium">
                    {t("adjustDialog.resulting", {
                      count: number(
                        Math.max(0, adjusting.quantityOnHand + delta),
                      ),
                    })}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdjusting(null)}
                  >
                    {tAdmin("actions.cancel")}
                  </Button>
                  <Button type="submit" disabled={delta === 0}>
                    {t("adjustDialog.submit")}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
