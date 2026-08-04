"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  PackageSearch,
  Search,
} from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The table behind every list in the admin — products, inventory, the audit
 * log, the team. Search, filter, sort, paginate, select and act in bulk, once.
 *
 * Generic over the row type rather than over a schema: callers describe their
 * columns with a `cell` renderer, so the table never needs to know what a
 * product is. That is what stops it growing a special case per screen, which is
 * how the second table gets written.
 *
 * **All state is local and in memory.** With services this becomes server-side
 * sorting and keyset pagination (**D-2**) — filtering 50,000 products in the
 * browser does not survive contact with a real catalog. The prop surface is
 * chosen so that change is internal: callers already pass a page of rows and a
 * total, they just start passing a different page.
 *
 * Labels come from `useTranslations` inside rather than from props. Threading
 * fourteen strings through every call site is how one of them ends up hardcoded.
 */

export type DataTableColumn<T> = {
  id: string;
  /** Already translated by the caller — it knows its own namespace. */
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Supplying this makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
  /** Hides the column below `lg`, for anything secondary on a narrow screen. */
  hideOnMobile?: boolean;
  className?: string;
};

export type DataTableFilter<T> = {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** `value` is `""` for "all", which never reaches this function. */
  match: (row: T, value: string) => boolean;
};

export type DataTableBulkAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onRun: (selectedIds: string[]) => void;
};

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

const PAGE_SIZES = [10, 25, 50] as const;

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  searchIn,
  filters = [],
  bulkActions = [],
  rowActions,
  initialSort,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  pageSize: initialPageSize = 10,
  className,
}: {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Returns the haystack for the search box. Omit to hide the box. */
  searchIn?: (row: T) => string;
  filters?: readonly DataTableFilter<T>[];
  bulkActions?: readonly DataTableBulkAction[];
  rowActions?: (row: T) => React.ReactNode;
  initialSort?: SortState;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder?: string;
  pageSize?: number;
  className?: string;
}) {
  const t = useTranslations("admin.table");

  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (needle && searchIn && !searchIn(row).toLowerCase().includes(needle)) {
        return false;
      }

      return filters.every((filter) => {
        const value = filterValues[filter.id];
        if (!value) return true;
        return filter.match(row, value);
      });
    });
  }, [rows, query, searchIn, filters, filterValues]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;

    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return filtered;

    const { sortValue } = column;
    const direction = sort.direction === "asc" ? 1 : -1;

    // A copy: sorting `filtered` in place mutates the memoised array and the
    // next render sorts an already-sorted list by a different key.
    return [...filtered].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);

      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }

      return String(left).localeCompare(String(right)) * direction;
    });
  }, [filtered, sort, columns]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamped rather than stored: filtering down to one page while on page 4
  // would otherwise show an empty table with no way back.
  const currentPage = Math.min(page, pageCount);
  const from = (currentPage - 1) * pageSize;
  const visible = sorted.slice(from, from + pageSize);

  const visibleIds = visible.map(getRowId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleAll(checked: boolean) {
    const next = new Set(selected);
    for (const id of visibleIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    setSelected(next);
  }

  function toggleRow(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  }

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: "asc" };
      if (current.direction === "asc") return { columnId, direction: "desc" };
      // Third click clears the sort and returns to the source order.
      return null;
    });
  }

  const hasFilters =
    query.trim() !== "" || Object.values(filterValues).some(Boolean);

  function clearFilters() {
    setQuery("");
    setFilterValues({});
    setPage(1);
  }

  const selectable = bulkActions.length > 0;
  const selectedCount = selected.size;

  return (
    <div className={cn("space-y-4", className)}>
      {(searchIn || filters.length > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {searchIn ? (
            <div className="relative w-full sm:max-w-xs">
              <label htmlFor="data-table-search" className="sr-only">
                {t("search")}
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="data-table-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder ?? t("searchPlaceholder")}
                className="ps-9"
                autoComplete="off"
              />
            </div>
          ) : null}

          {filters.map((filter) => (
            <div key={filter.id} className="w-full sm:w-auto">
              <Select
                value={filterValues[filter.id] ?? ""}
                onValueChange={(value) => {
                  setFilterValues((current) => ({
                    ...current,
                    [filter.id]: value === "__all" ? "" : value,
                  }));
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label={filter.label}
                >
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

          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
      )}

      {/* The bulk bar replaces nothing — it appears above the table so the
          selection count and the actions are adjacent, and it is a live region
          so a screen reader hears the count change. */}
      {selectable && selectedCount > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2"
        >
          <span className="text-sm font-medium">
            {t("selected", { count: selectedCount })}
          </span>
          <div className="ms-auto flex flex-wrap gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.destructive ? "destructive" : "outline"}
                onClick={() => action.onRun([...selected])}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="rounded-xl border border-dashed">
          <EmptyState
            icon={PackageSearch}
            title={hasFilters ? t("noResultsTitle") : emptyTitle}
            description={
              hasFilters ? t("noResultsDescription") : emptyDescription
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          {/* Horizontal scroll lives on the wrapper, so a wide table scrolls
              inside its own box instead of the page scrolling sideways. */}
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectable ? (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) =>
                          toggleAll(checked === true)
                        }
                        aria-label={t("selectAll")}
                      />
                    </TableHead>
                  ) : null}

                  {columns.map((column) => {
                    const isSorted = sort?.columnId === column.id;

                    return (
                      <TableHead
                        key={column.id}
                        className={cn(
                          column.align === "end" && "text-end",
                          column.hideOnMobile && "hidden lg:table-cell",
                          column.className,
                        )}
                        aria-sort={
                          isSorted
                            ? sort.direction === "asc"
                              ? "ascending"
                              : "descending"
                            : column.sortValue
                              ? "none"
                              : undefined
                        }
                      >
                        {column.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.id)}
                            className="inline-flex items-center gap-1.5 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            {column.header}
                            {isSorted ? (
                              sort.direction === "asc" ? (
                                <ArrowUp
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowDown
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              )
                            ) : (
                              <ChevronsUpDown
                                className="size-3.5 opacity-50"
                                aria-hidden="true"
                              />
                            )}
                            <span className="sr-only">
                              {isSorted && sort.direction === "asc"
                                ? t("sortDescending")
                                : t("sortAscending")}
                            </span>
                          </button>
                        ) : (
                          column.header
                        )}
                      </TableHead>
                    );
                  })}

                  {rowActions ? (
                    <TableHead className="w-12">
                      <span className="sr-only">{t("rowActions")}</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>

              <TableBody>
                {visible.map((row) => {
                  const id = getRowId(row);
                  const isSelected = selected.has(id);

                  return (
                    <TableRow
                      key={id}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      {selectable ? (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleRow(id, checked === true)
                            }
                            aria-label={t("selectRow")}
                          />
                        </TableCell>
                      ) : null}

                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={cn(
                            column.align === "end" && "text-end",
                            column.hideOnMobile && "hidden lg:table-cell",
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </TableCell>
                      ))}

                      {rowActions ? (
                        <TableCell className="text-end">
                          {rowActions(row)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="text-sm text-muted-foreground tabular-nums"
              role="status"
            >
              {t("showing", {
                from: from + 1,
                to: Math.min(from + pageSize, total),
                total,
              })}
            </p>

            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-28"
                  aria-label={t("rowsPerPage")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label={t("previous")}
              >
                <ChevronLeft />
              </Button>

              <span className="text-sm tabular-nums">
                {t("page", { page: currentPage, total: pageCount })}
              </span>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                aria-label={t("next")}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
