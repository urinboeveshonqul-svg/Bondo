import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid } from "lucide-react";

import { CategoryIcon } from "@/components/layout/category-icon";
import { SubcategorySheet } from "@/components/catalog/subcategory-sheet";
import { Link } from "@/i18n/navigation";
import {
  buildCatalogHref,
  withCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * The catalog's primary category row.
 *
 * ## What this replaces, and why
 *
 * The listing used to render **every** category as a filter chip — one flat row
 * of 102 buttons, 424px tall, with departments and subcategories in identical
 * pills. Capping it at the twelve departments fixed the height; it did not fix
 * the information architecture, which is what this component is for.
 *
 * Three levels now look like three levels:
 *
 * | Level        | Treatment                                                  |
 * | ------------ | ---------------------------------------------------------- |
 * | Department   | This row — bordered, iconed, one active state              |
 * | Subcategory  | `SubcategoryNav`, a lighter row that appears only in context |
 * | Filter       | The sidebar. Not a category, not shaped like one            |
 *
 * ## Desktop: some inline, the rest behind "More"
 *
 * Twelve department labels do not fit one desktop row — measured at 2423px
 * against a 1280px viewport when the header tried it. So the first
 * `INLINE_DEPARTMENTS` are inline and the remainder go in a disclosure, which
 * keeps the row one line high at every desktop width.
 *
 * **The disclosure is `<details>`, not a Radix menu.** It needs no JavaScript,
 * it is keyboard operable and announced correctly with no ARIA, and this listing
 * stays a Server Component because of it. The trade is real and worth stating:
 * `<details>` does not close on outside click or on Escape. For a list of links
 * — where the next click navigates anyway — that is a smaller cost than making
 * the catalog's primary navigation depend on hydration.
 *
 * ## Mobile: one horizontal scroller
 *
 * All twelve, scrolling sideways inside their own container. The container
 * scrolls; the page does not. That is the arrangement the brief names as
 * acceptable, and it beats a select on a phone because the shopper can see
 * where they are without opening anything.
 */

/** How many departments sit inline before the rest move into "More". */
const INLINE_DEPARTMENTS = 5;

/**
 * Above this many sections, the mobile subcategory row becomes a sheet.
 *
 * Declared here rather than in `subcategory-sheet.tsx` because that file is a
 * Client Component, and a plain value exported from a `"use client"` module
 * arrives in a Server Component as a client *reference*, not a number. The
 * comparison then silently evaluates false and the sheet never renders — which
 * is exactly what happened, with no error anywhere to say so.
 */
const SUBCATEGORY_SHEET_THRESHOLD = 6;

/**
 * 44px on a phone, 36px from `lg`.
 *
 * The row is the catalog's primary navigation and it is thumb-operated: WCAG 2.2
 * SC 2.5.8 puts the floor at 44px, and the previous `min-h-9` sat at 36. A mouse
 * pointer does not need the extra 8px, so the desktop row keeps its density.
 */
const CHIP =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:min-h-9 lg:px-3";

const CHIP_IDLE = "bg-background hover:bg-muted";

/**
 * The active state is a border and a weight change, not only a fill.
 *
 * Colour alone would fail anyone who cannot distinguish it, so `aria-current`
 * carries the same fact to assistive technology and the border carries it
 * visually (WCAG 1.4.1).
 */
const CHIP_ACTIVE = "border-primary bg-primary/10 font-medium text-primary";

export function CategoryNav({
  departments,
  query,
}: {
  departments: CategoryNavItem[];
  query: CatalogQuery;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;

  if (departments.length === 0) return null;

  const inline = departments.slice(0, INLINE_DEPARTMENTS);
  const overflow = departments.slice(INLINE_DEPARTMENTS);

  const hrefFor = (slug?: string) =>
    buildCatalogHref(withCatalogQuery(query, { category: slug }));

  const isActive = (item: CategoryNavItem) =>
    query.category === item.slug ||
    item.children.some((child) => child.slug === query.category);

  const allActive = !query.category;

  return (
    <nav aria-label={t("categoryNav")} className="border-b pb-3">
      {/*
        One list, two layouts. On a phone it scrolls sideways and shows every
        department; from `lg` it wraps to a single line and the tail moves into
        the disclosure beside it. `-mx-4 px-4` lets the scroller bleed to the
        screen edge so the last chip is not clipped mid-word.
      */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
        <li>
          <Link
            href={hrefFor(undefined)}
            aria-current={allActive ? "page" : undefined}
            className={cn(CHIP, allActive ? CHIP_ACTIVE : CHIP_IDLE)}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            {t("allCategories")}
          </Link>
        </li>

        {inline.map((department) => (
          <li key={department.id}>
            <Link
              href={hrefFor(department.slug)}
              aria-current={isActive(department) ? "page" : undefined}
              className={cn(
                CHIP,
                isActive(department) ? CHIP_ACTIVE : CHIP_IDLE,
              )}
            >
              <CategoryIcon name={department.icon} className="size-4" />
              {department.name[locale]}
            </Link>
          </li>
        ))}

        {/* The tail, inline on a phone because the row already scrolls. */}
        {overflow.map((department) => (
          <li key={department.id} className="lg:hidden">
            <Link
              href={hrefFor(department.slug)}
              aria-current={isActive(department) ? "page" : undefined}
              className={cn(
                CHIP,
                isActive(department) ? CHIP_ACTIVE : CHIP_IDLE,
              )}
            >
              <CategoryIcon name={department.icon} className="size-4" />
              {department.name[locale]}
            </Link>
          </li>
        ))}

        {overflow.length > 0 ? (
          <li className="relative hidden lg:block">
            <details className="group">
              <summary
                className={cn(
                  CHIP,
                  "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                  overflow.some(isActive) ? CHIP_ACTIVE : CHIP_IDLE,
                )}
              >
                {t("moreCategories")}
                <ChevronDown
                  className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>

              <ul className="absolute end-0 z-40 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-lg">
                {overflow.map((department) => (
                  <li key={department.id}>
                    <Link
                      href={hrefFor(department.slug)}
                      aria-current={isActive(department) ? "page" : undefined}
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-md px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        isActive(department)
                          ? "bg-primary/10 font-medium text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      <CategoryIcon
                        name={department.icon}
                        className="size-4 text-muted-foreground"
                      />
                      {department.name[locale]}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/**
 * The subcategories of whichever department the shopper is in.
 *
 * **Renders nothing unless there is something to render.** No department
 * selected, or a department with no children, means no second row — which is the
 * rule the brief asks for and the reason the old listing felt like a tag cloud:
 * it showed every level at once, always.
 *
 * Visually lighter than the row above it on purpose. These are text links with a
 * subtle active state, not bordered chips, so a glance separates "which
 * department" from "which part of it".
 */
export function SubcategoryNav({
  department,
  query,
}: {
  department: CategoryNavItem;
  query: CatalogQuery;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;

  if (department.children.length === 0) return null;

  const hrefFor = (slug: string) =>
    buildCatalogHref(withCatalogQuery(query, { category: slug }));

  const wholeDepartment = query.category === department.slug;

  /**
   * A long section list becomes a sheet on mobile and stays a row on desktop.
   *
   * Fifteen sections scrolling sideways under the departments' own scroller was
   * two rails competing for the same gesture — see `SubcategorySheet`. The
   * threshold is a count, not a breakpoint guess: a department with four
   * sections shows them, because opening a panel to pick from four is friction
   * with nothing behind it.
   */
  const useSheet = department.children.length > SUBCATEGORY_SHEET_THRESHOLD;

  return (
    <nav
      aria-label={t("subcategoryNav", { category: department.name[locale] })}
      className="border-b py-2.5"
    >
      {useSheet ? (
        <div className="pb-0.5 lg:hidden">
          <SubcategorySheet department={department} query={query} />
        </div>
      ) : null}

      <ul
        className={cn(
          "-mx-4 flex gap-x-1 gap-y-1 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0",
          useSheet && "hidden lg:flex",
        )}
      >
        <li>
          <Link
            href={hrefFor(department.slug)}
            aria-current={wholeDepartment ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:min-h-8 lg:px-2.5",
              wholeDepartment
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t("allInCategory")}
          </Link>
        </li>

        {department.children.map((child) => {
          const active = query.category === child.slug;

          return (
            <li key={child.id}>
              <Link
                href={hrefFor(child.slug)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:min-h-8 lg:px-2.5",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {child.name[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
