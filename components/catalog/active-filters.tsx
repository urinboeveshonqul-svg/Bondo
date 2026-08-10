import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Link } from "@/i18n/navigation";
import {
  buildCatalogHref,
  clearCatalogFilters,
  hasActiveFilters,
  toggleBrand,
  withCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { Locale } from "@/lib/site-config";
import { formatPrice } from "@/utils/format";

/**
 * What is currently narrowing the results, and how to undo each piece.
 *
 * ## Links, not buttons — so this stays a Server Component
 *
 * Every chip removes exactly one filter, and "the same query minus this one" is
 * a URL. Making them links means no JavaScript, they work before hydration, and
 * a shopper can middle-click one. `X` is decoration; the accessible name says
 * what removing it does.
 *
 * ## It shows filters only
 *
 * The category and the search term are not chips here. They are how the shopper
 * arrived, they are already stated by the breadcrumb and the `h1`, and a
 * "clear" that silently dropped the category would undo navigation rather than
 * filtering. `hasActiveFilters` draws that line in one place.
 *
 * Renders nothing at all when nothing is filtered — including the "clear"
 * control, which is the brief's requirement and also just true: there is nothing
 * to clear.
 */
export function ActiveFilters({
  query,
  brands,
}: {
  query: CatalogQuery;
  /** Slug → name, so a chip shows "ASUS" rather than the slug in the URL. */
  brands: { slug: string; name: string }[];
}) {
  const t = useTranslations("catalog.filters");
  const locale = useLocale() as Locale;

  if (!hasActiveFilters(query)) return null;

  const chip =
    "inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background px-3 text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  const priceLabel = () => {
    const min = query.minPrice;
    const max = query.maxPrice;

    // Minor units in the column, major units in the URL (ADR-2) — `formatPrice`
    // takes minor, so the shopper's number is converted back for display.
    if (min !== undefined && max !== undefined) {
      return `${formatPrice(min * 100, locale)} – ${formatPrice(max * 100, locale)}`;
    }
    if (min !== undefined)
      return t("priceFrom", { price: formatPrice(min * 100, locale) });
    return t("priceTo", { price: formatPrice((max ?? 0) * 100, locale) });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("active")}</span>

      {query.brands.map((slug) => {
        const name = brands.find((brand) => brand.slug === slug)?.name ?? slug;

        return (
          <Link
            key={slug}
            href={buildCatalogHref(toggleBrand(query, slug))}
            aria-label={t("remove", { filter: name })}
            className={chip}
          >
            {name}
            <X className="size-3 text-muted-foreground" aria-hidden="true" />
          </Link>
        );
      })}

      {query.minPrice !== undefined || query.maxPrice !== undefined ? (
        <Link
          href={buildCatalogHref(
            withCatalogQuery(query, {
              minPrice: undefined,
              maxPrice: undefined,
            }),
          )}
          aria-label={t("remove", { filter: priceLabel() })}
          className={chip}
        >
          {priceLabel()}
          <X className="size-3 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : null}

      {query.onSale ? (
        <Link
          href={buildCatalogHref(withCatalogQuery(query, { onSale: false }))}
          aria-label={t("remove", { filter: t("onSale") })}
          className={chip}
        >
          {t("onSale")}
          <X className="size-3 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : null}

      <Link
        href={buildCatalogHref(clearCatalogFilters(query))}
        className="rounded-sm px-1 text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("clear")}
      </Link>
    </div>
  );
}
