import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import {
  listCategoryNavigation,
  listProducts,
  readCatalog,
} from "@/services/catalog.reads";
import type { CategoryNavItem } from "@/types/catalog";
import type { PageParams, PageSearchParams } from "@/types";

/** Depth-first lookup by localized slug. Recursive, so nesting depth is free. */
function findBySlug(
  nodes: readonly CategoryNavItem[],
  slug: string,
): CategoryNavItem | null {
  for (const node of nodes) {
    if (node.slug === slug) return node;

    const found = findBySlug(node.children, slug);
    if (found) return found;
  }

  return null;
}

/** The node whose children contain `slug`, or `null` at the top level. */
function findParent(
  nodes: readonly CategoryNavItem[],
  slug: string,
): CategoryNavItem | null {
  for (const node of nodes) {
    if (node.children.some((child) => child.slug === slug)) return node;

    const found = findParent(node.children, slug);
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
 * Catalog listing.
 *
 * **Filtering and search now happen in the database.** The previous version
 * filtered an array in memory, which was fine for twelve fixtures and does not
 * survive 50,000 products (**D-2**). The search term goes through the
 * translation row for the reader's locale, using that locale's dictionary —
 * so a Russian query is stemmed with the Russian dictionary rather than
 * silently matching nothing.
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

  const resolved = await searchParams;
  const categorySlug =
    typeof resolved.category === "string" ? resolved.category : undefined;
  const query = typeof resolved.q === "string" ? resolved.q : undefined;

  const activeLocale = locale as Locale;
  const t = await getTranslations("catalog");

  // See `readCatalog` — a throw here would abort the shell, and the Suspense
  // boundary that `loading.tsx` opens above this route would turn that into a
  // permanent **200** with an empty skeleton (**K-19**).
  const data = await readCatalog(async () => {
    const [tree, results] = await Promise.all([
      // The nested tree, not the flat list. Rendering a filter chip per category
      // produced a **424px** strip of 102 buttons above every listing — more
      // vertical space than the results themselves on an empty catalog.
      listCategoryNavigation(activeLocale),
      listProducts(activeLocale, { categorySlug, query }),
    ]);

    return { tree, results };
  });

  if (!data) return <CatalogUnavailable />;

  const { tree, results } = data;

  const activeCategory = categorySlug ? findBySlug(tree, categorySlug) : null;

  /**
   * The filters, two rows deep at most.
   *
   * Departments are always offered, because they are how a shopper starts.
   * Underneath, the level that is useful *from here*: the children of the
   * department they are in, or — if they have already narrowed to a
   * subcategory — its siblings, so moving sideways does not mean going back up
   * first. Nothing deeper is shown, because a filter strip that lists the whole
   * taxonomy is the mega menu with worse ergonomics.
   */
  const departments = tree;
  const narrower = activeCategory
    ? activeCategory.children.length > 0
      ? activeCategory.children
      : (findParent(tree, activeCategory.slug)?.children ?? [])
    : [];

  const heading = activeCategory
    ? activeCategory.name[activeLocale]
    : t("title");
  const description = activeCategory?.description[activeLocale];

  return (
    <Container className="py-10 sm:py-14">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {heading}
        </h1>
        {description ? (
          <p className="text-pretty text-muted-foreground">{description}</p>
        ) : null}
        {query ? (
          <p className="text-sm text-muted-foreground">
            {t("showingResultsFor", { query })}
          </p>
        ) : null}
      </div>

      <nav aria-label={t("filterByCategory")} className="mb-8 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant={categorySlug ? "outline" : "default"}
          >
            <Link href={routes.catalog.index}>{t("all")}</Link>
          </Button>
          {departments.map((department) => (
            <Button
              key={department.id}
              asChild
              size="sm"
              // A department stays highlighted while a shopper is inside one of
              // its subcategories, so the strip shows where they are rather than
              // only what they last clicked.
              variant={
                activeCategory &&
                (activeCategory.id === department.id ||
                  department.children.some(
                    (child) => child.id === activeCategory.id,
                  ))
                  ? "default"
                  : "outline"
              }
            >
              <Link href={routes.catalog.byCategory(department.slug)}>
                {department.name[activeLocale]}
              </Link>
            </Button>
          ))}
        </div>

        {narrower.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t pt-2">
            {narrower.map((child) => (
              <Button
                key={child.id}
                asChild
                size="sm"
                variant={
                  activeCategory?.id === child.id ? "secondary" : "ghost"
                }
              >
                <Link href={routes.catalog.byCategory(child.slug)}>
                  {child.name[activeLocale]}
                </Link>
              </Button>
            ))}
          </div>
        ) : null}
      </nav>

      {/* The results region needs a heading of its own: the cards are `h3`, and
          without an `h2` between them and the page `h1` the outline skips a
          level. It is visually redundant next to the count, so it is exposed to
          assistive technology only. */}
      <h2 className="sr-only">{t("resultsHeading")}</h2>

      <p className="mb-4 text-sm text-muted-foreground" role="status">
        {/* An ICU plural, not `count === 1 ? … : …`. Russian needs three forms
            and picks between them by rules a ternary cannot express. */}
        {t("count", { count: results.length })}
      </p>

      <ProductGrid
        products={results}
        emptyTitle={
          query ? t("empty.noMatchTitle", { query }) : t("empty.categoryTitle")
        }
        emptyDescription={
          query ? t("empty.noMatchDescription") : t("empty.categoryDescription")
        }
        emptyAction={
          <Button asChild variant="outline">
            <Link href={routes.catalog.index}>{t("clearFilters")}</Link>
          </Button>
        }
      />
    </Container>
  );
}
