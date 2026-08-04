"use client";

import { useTranslations } from "next-intl";
import { Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * The controls that sit above every module list.
 *
 * Split out of `ModuleTable` so the three screens that are *not* tables — the
 * category tree, the homepage composer, the page grid — get the same search box
 * and the same filter shape without borrowing a table to do it. A module that
 * renders cards should still search the way a module that renders rows does.
 *
 * Every piece here is controlled. The state lives in whichever component owns
 * the list, because that component is the one that will eventually push it into
 * a query string and then into a Supabase filter (**D-2**).
 */

export type ModuleFilterOption = { value: string; label: string };

export type ModuleFilterDefinition = {
  id: string;
  label: string;
  options: readonly ModuleFilterOption[];
};

/** The search box. `""` means "no query", never `undefined`. */
export function ModuleSearch({
  value,
  onChange,
  placeholder,
  id = "module-search",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("admin.table");

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <label htmlFor={id} className="sr-only">
        {t("search")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t("searchPlaceholder")}
        className="ps-9"
        autoComplete="off"
      />
    </div>
  );
}

/**
 * One `<Select>` per filter.
 *
 * The "all" option carries a sentinel value rather than `""`, because Radix
 * treats an empty string as "no value" and the item becomes unselectable — a
 * filter you can apply but not clear.
 */
export function ModuleFilters({
  filters,
  values,
  onChange,
  className,
}: {
  filters: readonly ModuleFilterDefinition[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  className?: string;
}) {
  if (filters.length === 0) return null;

  return (
    <>
      {filters.map((filter) => (
        <div key={filter.id} className={cn("w-full sm:w-auto", className)}>
          <Select
            value={values[filter.id] ?? ""}
            onValueChange={(value) =>
              onChange(filter.id, value === "__all" ? "" : value)
            }
          >
            <SelectTrigger className="w-full sm:w-44" aria-label={filter.label}>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{filter.label}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </>
  );
}

/**
 * Column visibility.
 *
 * An admin list carries more columns than a laptop can show, and which ones
 * matter differs by job: a merchandiser wants price and status, a warehouse
 * operator wants SKU and stock. Hiding a column is a preference, not a
 * permission — a column an admin may not see is not rendered at all.
 *
 * The last visible column cannot be hidden. A table with no columns is a box of
 * checkboxes, and recovering from it means finding this menu again in an empty
 * page.
 */
export function ModuleColumnVisibility({
  columns,
  hidden,
  onToggle,
}: {
  columns: readonly { id: string; header: string }[];
  hidden: ReadonlySet<string>;
  onToggle: (id: string, visible: boolean) => void;
}) {
  const t = useTranslations("admin.table");
  const visibleCount = columns.filter((c) => !hidden.has(c.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal aria-hidden="true" />
          {t("columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("columnsHint")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          Rendered as labelled checkboxes rather than `DropdownMenuCheckboxItem`
          so the menu stays open while several are toggled. Closing after each
          one turns "show me SKU and stock" into three round trips.
        */}
        <div className="space-y-1 p-1">
          {columns.map((column) => {
            const isVisible = !hidden.has(column.id);
            const isLast = isVisible && visibleCount === 1;

            return (
              <label
                key={column.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                  isLast && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={isVisible}
                  disabled={isLast}
                  onCheckedChange={(checked) =>
                    onToggle(column.id, checked === true)
                  }
                />
                {column.header}
              </label>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The row the controls sit in.
 *
 * Search on the start edge, filters beside it, everything the caller adds on the
 * end edge. Fixed so an operator moving between modules reaches for the same
 * place — the layout is the part that has to be identical, not the contents.
 */
export function ModuleToolbar({
  search,
  filters,
  children,
  onClear,
  isFiltered = false,
  className,
}: {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  /** Trailing controls — column visibility, export, a view switch. */
  children?: React.ReactNode;
  onClear?: () => void;
  isFiltered?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.table");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {search}
      {filters}

      {isFiltered && onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {t("clearFilters")}
        </Button>
      ) : null}

      {children ? (
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
}
