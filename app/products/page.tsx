import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { categories, products } from "@/mocks/catalog";
import type { PageSearchParams } from "@/types";
import type { ProductSummary } from "@/types/catalog";

export const metadata: Metadata = {
  title: "All products",
  description: `Browse every product ${siteConfig.name} stocks — systems, components and accessories.`,
  alternates: { canonical: routes.catalog.index },
};

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
 * real URL that can be shared, bookmarked and opened in a new tab.
 */
function filterProducts(
  category: string | undefined,
  query: string | undefined,
): ProductSummary[] {
  let result: ProductSummary[] = products;

  if (category) {
    result = result.filter((p) => p.category === category);
  }

  if (query) {
    // Matches the fields the database's `search_vector` weights highest — name,
    // SKU and brand — so results here resemble what the real query returns.
    const needle = query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle) ||
        p.brand.toLowerCase().includes(needle),
    );
  }

  return result;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const category =
    typeof params.category === "string" ? params.category : undefined;
  const query = typeof params.q === "string" ? params.q : undefined;

  const activeCategory = categories.find((c) => c.slug === category);
  const results = filterProducts(category, query);

  const heading = activeCategory?.name ?? "All products";
  const description = activeCategory?.description;

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
            Showing results for <span className="font-medium">“{query}”</span>
          </p>
        ) : null}
      </div>

      <nav
        aria-label="Filter by category"
        className="mb-8 flex flex-wrap gap-2"
      >
        <Button asChild size="sm" variant={category ? "outline" : "default"}>
          <Link href={routes.catalog.index}>All</Link>
        </Button>
        {categories.map((c) => (
          <Button
            key={c.slug}
            asChild
            size="sm"
            variant={category === c.slug ? "default" : "outline"}
          >
            <Link href={routes.catalog.byCategory(c.slug)}>{c.name}</Link>
          </Button>
        ))}
      </nav>

      {/* The results region needs a heading of its own: the cards are `h3`, and
          without an `h2` between them and the page `h1` the outline skips a
          level. It is visually redundant next to the count, so it is exposed to
          assistive technology only. */}
      <h2 className="sr-only">Products</h2>

      <p className="mb-4 text-sm text-muted-foreground" role="status">
        {results.length} {results.length === 1 ? "product" : "products"}
      </p>

      <ProductGrid
        products={results}
        emptyTitle={
          query ? `Nothing matches “${query}”` : "No products here yet"
        }
        emptyDescription={
          query
            ? "Try a shorter term, or search by brand or SKU."
            : "This category has no products at the moment."
        }
        emptyAction={
          <Button asChild variant="outline">
            <Link href={routes.catalog.index}>Clear filters</Link>
          </Button>
        }
      />
    </Container>
  );
}
