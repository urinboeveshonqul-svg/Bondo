"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The bar that appears when rows are selected.
 *
 * It sits **above** the list rather than floating over it: a fixed bar covers
 * the last row on a short viewport, which is exactly where the row someone just
 * selected tends to be.
 *
 * `role="status"` so a screen reader hears the count change without the focus
 * moving. Selecting a row is not a navigation.
 */

export type ModuleBulkAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onRun: (selectedIds: string[]) => void;
};

export function ModuleBulkActions({
  actions,
  selectedIds,
  onClear,
  className,
}: {
  actions: readonly ModuleBulkAction[];
  selectedIds: readonly string[];
  onClear?: () => void;
  className?: string;
}) {
  const t = useTranslations("admin.table");

  if (actions.length === 0 || selectedIds.length === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2",
        className,
      )}
    >
      <span className="text-sm font-medium">
        {t("selected", { count: selectedIds.length })}
      </span>

      {onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t("clearSelection")}
        </Button>
      ) : null}

      <div className="ms-auto flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant={action.destructive ? "destructive" : "outline"}
            onClick={() => action.onRun([...selectedIds])}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
