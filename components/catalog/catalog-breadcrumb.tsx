import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  buildCatalogHref,
  withCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * Where the shopper is: home → department → subcategory.
 *
 * Deliberately quiet — small, muted, one line. A breadcrumb is orientation, not
 * a heading, and the moment it competes with the `h1` under it the page has two
 * titles.
 *
 * A real `<nav>` with an ordered list and `aria-current="page"` on the last
 * crumb, which is the structure assistive technology expects. The separators are
 * `aria-hidden` so the trail is not read as "Home chevron Laptops chevron".
 *
 * The trail is built from the category tree the page already has, so it costs no
 * query and is correct at any depth — three levels would render three crumbs
 * without a change here.
 */
export function CatalogBreadcrumb({
  trail,
  query,
}: {
  /** Root-first ancestors of the active category, the category itself last. */
  trail: CategoryNavItem[];
  query: CatalogQuery;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;

  // Nothing to orient by on the unfiltered catalog — the `h1` says where you
  // are, and "Home / All products" is a crumb that tells nobody anything.
  if (trail.length === 0) return null;

  return (
    <nav aria-label={t("breadcrumb")} className="mb-2">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        <li>
          <Link
            href={routes.home}
            className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("home")}
          </Link>
        </li>

        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li key={item.id} className="flex items-center gap-1.5">
              <ChevronRight className="size-3" aria-hidden="true" />
              {isLast ? (
                <span aria-current="page" className="text-foreground">
                  {item.name[locale]}
                </span>
              ) : (
                <Link
                  href={buildCatalogHref(
                    withCatalogQuery(query, { category: item.slug }),
                  )}
                  className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {item.name[locale]}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
