"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownWideNarrow, SlidersHorizontal } from "lucide-react";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  buildCatalogHref,
  CATALOG_SORTS,
  withCatalogQuery,
  type CatalogQuery,
  type CatalogSort,
} from "@/lib/catalog/search-params";

/**
 * The bar above the grid: how many results, how to sort them, and — on a phone
 * — the way into the filters.
 *
 * ## Why the filter button is here and not in the sidebar
 *
 * There is no sidebar on a phone. The brief is explicit that the desktop sidebar
 * must not simply stack above the products on mobile, because a shopper then
 * scrolls past every filter to reach the first product. So the same
 * `CatalogFilters` renders in two places: inline in the sidebar from `lg`, and
 * inside this sheet below it. One component, so the two cannot drift.
 *
 * The trigger is hidden from `lg` rather than the sheet being unmounted — the
 * markup is identical either way and CSS decides which is reachable.
 *
 * ## Sorting is a `<Select>`
 *
 * Radix, so it is keyboard operable and announced as a listbox. It navigates on
 * change: sort is URL state like every other control here, so the order survives
 * a reload and a shared link.
 */
export function CatalogToolbar({
  query,
  total,
  brands,
  priceRange,
}: {
  query: CatalogQuery;
  total: number;
  brands: { slug: string; name: string; productCount: number }[];
  priceRange: { min: number; max: number } | null;
}) {
  const t = useTranslations("catalog");
  const tSort = useTranslations("catalog.sort");
  const tFilters = useTranslations("catalog.filters");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const activeCount =
    query.brands.length +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0) +
    (query.onSale ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/*
        `role="status"` so a screen reader hears the new count after a filter
        changes it — the visual change is obvious and the announcement is not.
      */}
      <p className="text-sm text-muted-foreground" role="status">
        {t("count", { count: total })}
      </p>

      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden">
              <SlidersHorizontal aria-hidden="true" />
              {tFilters("title")}
              {activeCount > 0 ? (
                <span className="ms-0.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle className="text-start">
                {tFilters("title")}
              </SheetTitle>
              <SheetDescription className="text-start">
                {tFilters("description")}
              </SheetDescription>
            </SheetHeader>

            <div className="overflow-y-auto px-4 pb-8">
              <CatalogFilters
                query={query}
                brands={brands}
                priceRange={priceRange}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-1.5">
          <ArrowDownWideNarrow
            className="size-4 shrink-0 text-muted-foreground lg:hidden"
            aria-hidden="true"
          />
          <Select
            value={query.sort}
            disabled={pending}
            onValueChange={(value) =>
              startTransition(() => {
                router.push(
                  buildCatalogHref(
                    withCatalogQuery(query, { sort: value as CatalogSort }),
                  ),
                );
              })
            }
          >
            <SelectTrigger size="sm" aria-label={tSort("label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {CATALOG_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {tSort(sort)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
