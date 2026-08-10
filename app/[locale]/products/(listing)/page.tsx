import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProductGrid } from "@/components/home/product-grid";
import { ActiveFilters } from "@/components/catalog/active-filters";
import { CatalogBreadcrumb } from "@/components/catalog/catalog-breadcrumb";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { CatalogToolbar } from "@/components/catalog/catalog-toolbar";
import { CategoryNav, SubcategoryNav } from "@/components/catalog/category-nav";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import {
  buildCatalogHref,
  parseCatalogQuery,
  withCatalogQuery,
} from "@/lib/catalog/search-params";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import {
  listCatalog,
  listCategoryNavigation,
  readCatalog,
} from "@/services/catalog.reads";
import type { CategoryNavItem } from "@/types/catalog";
import type { PageParams, PageSearchParams } from "@/types";

/**
 * Finds a category by localized slug and returns the path to it, root first.
 *
 * One walk produces both the node and its ancestors, which is what the
 * breadcrumb, the subcategory row and the heading all need — three consumers,
 * one traversal, no repeated searching. Recursive, so a third level costs
 * nothing here.
 */
function findTrail(
  nodes: readonly CategoryNavItem[],
  slug: string,
  ancestors: CategoryNavItem[] = [],
): CategoryNavItem[] | null {
  for (const node of nodes) {
    const trail = [...ancestors, node];
    if (node.slug === slug) return trail;

    const found = findTrail(node.children, slug, trail);
    if (found) return found;
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });

  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale as Locale, routes.catalog.index),
  };
}

/**
 * The catalog listing.
 *
 * ## Information architecture
 *
 * Four levels, and each looks like itself:
 *
 * ```
 * departments      CategoryNav      bordered chips, one active
 *   subcategories  SubcategoryNav   lighter text links, only when in a department
 *     filters      CatalogFilters   a sidebar, or a sheet on a phone
 *       products   ProductGrid
 * ```
 *
 * The previous version collapsed all of that into one row of chips — every
 * category at every level, in identical pills, above every listing. Nothing
 * about it told a shopper which level they were looking at.
 *
 * ## A Server Component with two interactive islands
 *
 * The page reads `searchParams`, queries, and renders. There is no client-side
 * filter state: the URL *is* the state (`lib/catalog/search-params`), so every
 * filter is shareable, bookmarkable and survives the back button. Only
 * `CatalogFilters` and `CatalogToolbar` are client components, because a
 * checkbox and a sheet need to be.
 *
 * Category navigation, the breadcrumb and the active-filter chips are all
 * server-rendered links — they work before hydration and cost no JavaScript.
 *
 * ## Queries
 *
 * `listCategoryNavigation` is memoised per request and already fetched for the
 * header, so the tree here is free. `listCatalog` is the products, the exact
 * count, the brands with products, and the price bounds.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activeLocale = locale as Locale;
  const t = await getTranslations("catalog");
  const query = parseCatalogQuery(await searchParams);

  // See `readCatalog` — a throw here would abort the shell, and the Suspense
  // boundary `loading.tsx` opens above this route would turn that into a
  // permanent 200 with an empty skeleton (**K-19**).
  const data = await readCatalog(async () => {
    const [tree, page] = await Promise.all([
      listCategoryNavigation(activeLocale),
      listCatalog(activeLocale, query),
    ]);

    return { tree, page };
  });

  if (!data) return <CatalogUnavailable />;

  const { tree, page } = data;

  const trail = query.category ? (findTrail(tree, query.category) ?? []) : [];
  const active = trail.at(-1) ?? null;

  // The department whose children the second row lists: the active category if
  // it has any, otherwise its parent — so standing in "Videokartalar" still
  // shows the other components beside it.
  const department = active
    ? active.children.length > 0
      ? active
      : (trail.at(-2) ?? null)
    : null;

  const heading = active ? active.name[activeLocale] : t("title");
  const description = active?.description[activeLocale];

  return (
    <Container className="py-6 sm:py-8">
      <CategoryNav departments={tree} query={query} />

      {department ? (
        <SubcategoryNav department={department} query={query} />
      ) : null}

      <div className="mt-6">
        <CatalogBreadcrumb trail={trail} query={query} />

        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {heading}
        </h1>

        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}

        {query.q ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("showingResultsFor", { query: query.q })}
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        {/*
          The sidebar. `hidden lg:block` rather than reordering on mobile: the
          same panel is rendered inside the toolbar's sheet there, so a phone
          never scrolls past a column of filters to reach the first product.
        */}
        <aside
          aria-labelledby="catalog-filters-heading"
          className="hidden lg:block"
        >
          <h2
            id="catalog-filters-heading"
            className="mb-3 text-xs font-semibold tracking-wide uppercase"
          >
            {t("filters.title")}
          </h2>
          <CatalogFilters
            query={query}
            brands={page.brands}
            priceRange={page.priceRange}
          />
        </aside>

        <div className="min-w-0 space-y-4">
          <CatalogToolbar
            query={query}
            total={page.total}
            brands={page.brands}
            priceRange={page.priceRange}
          />

          <ActiveFilters query={query} brands={page.brands} />

          {/* The cards are `h3`; without an `h2` between them and the page `h1`
              the outline skips a level. Redundant next to the count, so it is
              exposed to assistive technology only. */}
          <h2 className="sr-only">{t("resultsHeading")}</h2>

          <ProductGrid
            products={page.products}
            emptyTitle={
              query.q
                ? t("empty.noMatchTitle", { query: query.q })
                : active
                  ? t("empty.categoryTitle")
                  : t("empty.defaultTitle")
            }
            emptyDescription={
              query.q
                ? t("empty.noMatchDescription")
                : active
                  ? t("empty.categoryDescription")
                  : t("empty.defaultDescription")
            }
            emptyAction={
              // Only offered when it would actually change the result. On the
              // unfiltered, uncategorised catalog it would reload the same page.
              active || query.q || page.total === 0 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.catalog.index}>{t("browseAll")}</Link>
                </Button>
              ) : undefined
            }
          />

          {page.pageCount > 1 ? (
            <nav
              aria-label={t("pagination")}
              className="flex items-center justify-between gap-3 border-t pt-4"
            >
              <Button
                asChild={page.page > 1}
                size="sm"
                variant="outline"
                disabled={page.page <= 1}
              >
                {page.page > 1 ? (
                  <Link
                    href={buildCatalogHref(
                      withCatalogQuery(query, { page: page.page - 1 }),
                    )}
                    rel="prev"
                  >
                    {t("previous")}
                  </Link>
                ) : (
                  <span>{t("previous")}</span>
                )}
              </Button>

              <span className="text-sm text-muted-foreground">
                {t("pageOf", { page: page.page, total: page.pageCount })}
              </span>

              <Button
                asChild={page.page < page.pageCount}
                size="sm"
                variant="outline"
                disabled={page.page >= page.pageCount}
              >
                {page.page < page.pageCount ? (
                  <Link
                    href={buildCatalogHref(
                      withCatalogQuery(query, { page: page.page + 1 }),
                    )}
                    rel="next"
                  >
                    {t("next")}
                  </Link>
                ) : (
                  <span>{t("next")}</span>
                )}
              </Button>
            </nav>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
