"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import {
  ModuleBulkActions,
  type ModuleBulkAction,
} from "@/components/admin/module/module-bulk-actions";
import { ModuleEmptyState } from "@/components/admin/module/module-empty-state";
import { ModulePagination } from "@/components/admin/module/module-pagination";
import {
  ModuleColumnVisibility,
  ModuleFilters,
  ModuleSearch,
  ModuleToolbar,
  type ModuleFilterOption,
} from "@/components/admin/module/module-toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
 * The table behind every module list — products, inventory, the audit log, the
 * team. Search, filter, sort, paginate, select, act in bulk and choose columns,
 * once.
 *
 * Generic over the row type rather than over a schema: callers describe their
 * columns with a `cell` renderer, so the table never needs to know what a
 * product is. That is what stops it growing a special case per screen, which is
 * how the second table gets written.
 *
 * **A module never writes its own table.** The rule is in
 * `docs/admin/architecture.md` and it is not about looks: a bespoke list is one
 * that quietly lacks a keyboard-reachable sort, or an `aria-sort`, or a
 * selection count a screen reader can hear. Those are invisible in review and
 * obvious to the person who depends on them.
 *
 * The toolbar, bulk bar and pagination are separate components rather than
 * private markup, because three module screens are not tables — the category
 * tree, the homepage composer, the page grid — and they need the same search box
 * without borrowing a table to get it.
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

export type ModuleTableColumn<T> = {
  id: string;
  /** Already translated by the caller — it knows its own namespace. */
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Supplying this makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
  /** Hides the column below `lg`, for anything secondary on a narrow screen. */
  hideOnMobile?: boolean;
  /** Starts hidden; the operator can bring it back from the columns menu. */
  hiddenByDefault?: boolean;
  /** Keeps the column out of the visibility menu — for the identity column. */
  alwaysVisible?: boolean;
  className?: string;
};

export type ModuleTableFilter<T> = {
  id: string;
  label: string;
  options: readonly ModuleFilterOption[];
  /** `value` is `""` for "all", which never reaches this function. */
  match: (row: T, value: string) => boolean;
};

export type { ModuleBulkAction };

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

export function ModuleTable<T>({
  rows,
  columns,
  getRowId,
  searchIn,
  filters = [],
  bulkActions = [],
  rowActions,
  toolbarActions,
  initialSort,
  emptyTitle,
  emptyDescription,
  emptyAction,
  searchPlaceholder,
  pageSize: initialPageSize = 10,
  className,
}: {
  rows: readonly T[];
  columns: readonly ModuleTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Returns the haystack for the search box. Omit to hide the box. */
  searchIn?: (row: T) => string;
  filters?: readonly ModuleTableFilter<T>[];
  bulkActions?: readonly ModuleBulkAction[];
  rowActions?: (row: T) => React.ReactNode;
  /** Trailing toolbar controls — export, a view switch, anything module-specific. */
  toolbarActions?: React.ReactNode;
  initialSort?: SortState;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
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
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(
    () => new Set(columns.filter((c) => c.hiddenByDefault).map((c) => c.id)),
  );

  const visibleColumns = columns.filter((c) => !hiddenColumns.has(c.id));

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
  const toggleableColumns = columns.filter((c) => !c.alwaysVisible);

  return (
    <div className={cn("space-y-4", className)}>
      <ModuleToolbar
        isFiltered={hasFilters}
        onClear={clearFilters}
        search={
          searchIn ? (
            <ModuleSearch
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
            />
          ) : undefined
        }
        filters={
          <ModuleFilters
            filters={filters}
            values={filterValues}
            onChange={(id, value) => {
              setFilterValues((current) => ({ ...current, [id]: value }));
              setPage(1);
            }}
          />
        }
      >
        {toolbarActions}
        {toggleableColumns.length > 1 ? (
          <ModuleColumnVisibility
            columns={toggleableColumns}
            hidden={hiddenColumns}
            onToggle={(id, isVisible) =>
              setHiddenColumns((current) => {
                const next = new Set(current);
                if (isVisible) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
        ) : null}
      </ModuleToolbar>

      <ModuleBulkActions
        actions={bulkActions}
        selectedIds={[...selected]}
        onClear={() => setSelected(new Set())}
      />

      {total === 0 ? (
        <ModuleEmptyState
          title={hasFilters ? t("noResultsTitle") : emptyTitle}
          description={
            hasFilters ? t("noResultsDescription") : emptyDescription
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            ) : (
              emptyAction
            )
          }
        />
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

                  {visibleColumns.map((column) => {
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

                      {visibleColumns.map((column) => (
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

          <ModulePagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            from={from + 1}
            to={Math.min(from + pageSize, total)}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
