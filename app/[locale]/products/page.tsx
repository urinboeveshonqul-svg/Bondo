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
  listCategories,
  listProducts,
  readCatalog,
} from "@/services/catalog.reads";
import type { PageParams, PageSearchParams } from "@/types";

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
    const [categories, results] = await Promise.all([
      listCategories(activeLocale),
      listProducts(activeLocale, { categorySlug, query }),
    ]);

    return { categories, results };
  });

  if (!data) return <CatalogUnavailable />;

  const { categories, results } = data;

  const activeCategory = categories.find((c) => c.slug === categorySlug);
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

      <nav
        aria-label={t("filterByCategory")}
        className="mb-8 flex flex-wrap gap-2"
      >
        <Button
          asChild
          size="sm"
          variant={categorySlug ? "outline" : "default"}
        >
          <Link href={routes.catalog.index}>{t("all")}</Link>
        </Button>
        {categories.map((category) => (
          <Button
            key={category.slug}
            asChild
            size="sm"
            variant={categorySlug === category.slug ? "default" : "outline"}
          >
            <Link href={routes.catalog.byCategory(category.slug)}>
              {category.name[activeLocale]}
            </Link>
          </Button>
        ))}
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
