"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Page controls plus the "showing x–y of z" line.
 *
 * The range is a live region so paging announces the new range rather than
 * leaving a keyboard user to guess whether the button did anything.
 *
 * **This is offset pagination, and it does not survive 50,000 products
 * (D-2).** The prop surface is chosen so the replacement is internal: a caller
 * already passes a page of rows and a total, and keyset pagination changes what
 * "next" means without changing what this component is handed. `total` becomes
 * an estimate at that point, which is why the range line is rendered from
 * `from`/`to` rather than computed from the page number.
 */

export const MODULE_PAGE_SIZES = [10, 25, 50] as const;

export function ModulePagination({
  page,
  pageCount,
  pageSize,
  from,
  to,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  /** 1-based, inclusive, already clamped by the caller. */
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}) {
  const t = useTranslations("admin.table");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums" role="status">
        {t("showing", { from, to, total })}
      </p>

      <div className="flex items-center gap-2">
        {onPageSizeChange ? (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              size="sm"
              className="w-28"
              aria-label={t("rowsPerPage")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULE_PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t("previous")}
        >
          <ChevronLeft />
        </Button>

        <span className="text-sm tabular-nums">
          {t("page", { page, total: pageCount })}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          aria-label={t("next")}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
