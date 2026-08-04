"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * The trail above each admin page.
 *
 * Rendered as an ordered list with `aria-current="page"` on the last crumb, so
 * a screen reader announces both the depth and where "here" is. The separators
 * are `aria-hidden` — a chevron read aloud between every level is noise.
 *
 * Crumbs are passed in by each page rather than derived from the URL. A path
 * segment is an id, not a name: `/admin/products/c0000000-…` would produce a
 * UUID in the trail, and deriving the product's name from the URL means
 * re-fetching it in a component that has no business doing so.
 */
export type Crumb = { label: string; href?: string };

export function AdminBreadcrumbs({ items }: { items: readonly Crumb[] }) {
  const t = useTranslations("admin.breadcrumb");

  if (items.length === 0) return null;

  return (
    <nav aria-label={t("label")}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            href={routes.admin.index}
            className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("home")}
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              <li aria-hidden="true">
                <ChevronRight className="size-3.5" />
              </li>
              <li
                aria-current={isLast ? "page" : undefined}
                className={isLast ? "font-medium text-foreground" : undefined}
              >
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {item.label}
                  </Link>
                ) : (
                  item.label
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
