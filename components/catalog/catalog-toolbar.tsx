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
    /*
      Two rows on a phone, one from `lg`.

      Wrapping a count, a filter button and a sort select onto one 390px line put
      all three at `size="sm"` — 28px tall, side by side, each squeezed to fit.
      The count is text and does not compete for the tap; giving it its own line
      leaves the full width for two controls that are actually pressed.
    */
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3">
      {/*
        `role="status"` so a screen reader hears the new count after a filter
        changes it — the visual change is obvious and the announcement is not.
      */}
      <p className="text-sm text-muted-foreground" role="status">
        {t("count", { count: total })}
      </p>

      <div className="grid grid-cols-2 items-center gap-2 lg:flex">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            {/* 44px and full-width on touch; the compact desktop size from lg. */}
            <Button variant="outline" className="h-11 w-full lg:hidden">
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

        {/*
          The sort icon is decorative and was costing horizontal space the
          select's own label needs — Russian sort labels run half again as long
          as the Uzbek ones, and at 390px the trigger was truncating them. It
          stays on desktop, where the row has room.
        */}
        <div className="flex min-w-0 items-center gap-1.5">
          <ArrowDownWideNarrow
            className="hidden size-4 shrink-0 text-muted-foreground lg:block"
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
            <SelectTrigger
              aria-label={tSort("label")}
              className="w-full min-w-0 data-[size=default]:h-11 lg:data-[size=default]:h-7"
            >
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
