import type { Metadata } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { categories, products } from "@/mocks/catalog";
import type { PageParams, PageSearchParams } from "@/types";
import type { ProductSummary } from "@/types/catalog";

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
 * Exists in this phase so the home page's product cards and category menu have
 * somewhere real to go — the project does not ship links to routes that 404.
 * It is deliberately the simple version: filter by category, filter by search
 * term, and an empty state. Sorting, faceting and keyset pagination arrive with
 * the catalog service, where they can be done in the query rather than in
 * memory (D-2).
 *
 * Filtering happens on the server from `searchParams`, so a filtered view is a
 * real URL that can be shared, bookmarked and opened in a new tab — in the
 * language the sharer was reading, because the locale is part of the path.
 */
function filterProducts(
  category: string | undefined,
  query: string | undefined,
  locale: Locale,
): ProductSummary[] {
  let result: ProductSummary[] = products;

  if (category) {
    result = result.filter((p) => p.category === category);
  }

  if (query) {
    // Matches the fields the database's `search_vector` weights highest — name,
    // SKU and brand — so results here resemble what the real query returns.
    //
    // `toLocaleLowerCase(locale)` rather than `toLowerCase()`: the latter is
    // locale-independent and gets Turkish-style dotted/dotless I wrong. It makes
    // no difference for these three locales today, and costs nothing to get
    // right before a fourth is added.
    const needle = query.toLocaleLowerCase(locale);
    result = result.filter(
      (p) =>
        p.name[locale].toLocaleLowerCase(locale).includes(needle) ||
        p.sku.toLocaleLowerCase(locale).includes(needle) ||
        p.brand.toLocaleLowerCase(locale).includes(needle),
    );
  }

  return result;
}

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
  const category =
    typeof resolved.category === "string" ? resolved.category : undefined;
  const query = typeof resolved.q === "string" ? resolved.q : undefined;

  return <ProductsListing category={category} query={query} />;
}

function ProductsListing({
  category,
  query,
}: {
  category: string | undefined;
  query: string | undefined;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;

  const activeCategory = categories.find((c) => c.slug === category);
  const results = filterProducts(category, query, locale);

  const heading = activeCategory ? activeCategory.name[locale] : t("title");
  const description = activeCategory?.description[locale];

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
        <Button asChild size="sm" variant={category ? "outline" : "default"}>
          <Link href={routes.catalog.index}>{t("all")}</Link>
        </Button>
        {categories.map((c) => (
          <Button
            key={c.slug}
            asChild
            size="sm"
            variant={category === c.slug ? "default" : "outline"}
          >
            <Link href={routes.catalog.byCategory(c.slug)}>
              {c.name[locale]}
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
