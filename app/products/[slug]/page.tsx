import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Heart, ShieldCheck, ShoppingCart, Truck } from "lucide-react";

import { DiscountBadge, Price } from "@/components/commerce/price";
import { ProductImage } from "@/components/commerce/product-image";
import { Rating } from "@/components/commerce/rating";
import { StockIndicator } from "@/components/commerce/stock-indicator";
import { ProductGrid } from "@/components/home/product-grid";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/lib/routes";
import {
  getProductBySlug,
  getProductsByCategory,
  products,
} from "@/mocks/catalog";
import type { PageParams } from "@/types";
import { getStockLevel } from "@/utils/catalog";

/**
 * Product detail.
 *
 * `generateStaticParams` prerenders every product at build time. That is right
 * for a fixed mock set and stays right for a real catalog of this size; at
 * 50,000 products it becomes `dynamicParams` with on-demand ISR, which is a
 * change to this function alone.
 */
export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.shortDescription,
    // Per-page canonical, never on the root layout — a root canonical would
    // tell crawlers the whole catalog duplicates one URL (ADR-15).
    alternates: { canonical: routes.catalog.detail(product.slug) },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: PageParams<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  const isOutOfStock = getStockLevel(product.stock) === "out-of-stock";
  const related = getProductsByCategory(product.category)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  // Specs arrive flat and are grouped for display, matching how
  // `product_specifications.spec_group` is stored.
  const specGroups = product.specs.reduce<Record<string, typeof product.specs>>(
    (groups, spec) => {
      const key = spec.group ?? "General";
      (groups[key] ??= []).push(spec);
      return groups;
    },
    {},
  );

  return (
    <Container className="py-8 sm:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={routes.home} className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={routes.catalog.index} className="hover:text-foreground">
              Products
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={routes.catalog.byCategory(product.category)}
              className="hover:text-foreground"
            >
              {product.category.replace(/-/g, " ")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImage
          name={product.name}
          brand={product.brand}
          className="rounded-xl border"
          priority
        />

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {product.brand}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-pretty text-muted-foreground">
              {product.shortDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Rating rating={product.rating} reviewCount={product.reviewCount} />
            <Badge variant="outline" className="font-mono text-xs">
              {product.sku}
            </Badge>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Price product={product} size="large" />
              <DiscountBadge product={product} />
            </div>
            <StockIndicator stock={product.stock} />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              disabled={isOutOfStock}
              className="flex-1 sm:flex-none"
            >
              <ShoppingCart aria-hidden="true" />
              {isOutOfStock ? "Out of stock" : "Add to basket"}
            </Button>
            <Button size="lg" variant="outline" disabled>
              <Heart aria-hidden="true" />
              Save
            </Button>
          </div>

          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              {product.warrantyMonths / 12}-year warranty
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 shrink-0" aria-hidden="true" />
              Free delivery on orders over $150
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="description-heading">
          <h2
            id="description-heading"
            className="mb-3 text-xl font-semibold tracking-tight"
          >
            About this product
          </h2>
          <p className="text-pretty text-muted-foreground">
            {product.description}
          </p>
        </section>

        <section aria-labelledby="specs-heading">
          <h2
            id="specs-heading"
            className="mb-3 text-xl font-semibold tracking-tight"
          >
            Specifications
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Technical specifications for {product.name}
              </caption>
              <tbody>
                {Object.entries(specGroups).map(([group, specs]) => (
                  // A keyed Fragment, not `<>`: the shorthand cannot take a
                  // key, and each group emits sibling rows rather than one node.
                  <Fragment key={group}>
                    <tr className="bg-muted/50">
                      <th
                        scope="colgroup"
                        colSpan={2}
                        className="px-4 py-2 text-start text-xs font-semibold tracking-wide uppercase"
                      >
                        {group}
                      </th>
                    </tr>
                    {specs.map((spec) => (
                      <tr key={`${group}-${spec.name}`} className="border-t">
                        <th
                          scope="row"
                          className="w-1/2 px-4 py-2.5 text-start font-normal text-muted-foreground"
                        >
                          {spec.name}
                        </th>
                        <td className="px-4 py-2.5 font-medium">
                          {spec.value}
                          {spec.unit ? ` ${spec.unit}` : ""}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading" className="mt-14">
          <h2
            id="related-heading"
            className="mb-6 text-2xl font-semibold tracking-tight"
          >
            More in {product.category.replace(/-/g, " ")}
          </h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </Container>
  );
}
