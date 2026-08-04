import { Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import {
  getProductBySlug,
  listCategories,
  listProductsByCategory,
  readCatalog,
} from "@/services/catalog.reads";
import type { PageParams } from "@/types";
import { getStockLevel } from "@/utils/catalog";
import { formatPrice } from "@/utils/format";

/** Free-delivery threshold, in integer minor units like every other amount. */
const FREE_DELIVERY_THRESHOLD_CENTS = 15000;

/**
 * Product detail.
 *
 * **Rendered on demand, no longer prerendered.** `generateStaticParams` used to
 * enumerate every product at build time; with the catalog in the database that
 * would mean querying during the build, which fails when no project is reachable
 * and does not scale to 50,000 products in any case. On-demand rendering plus
 * ISR is where a catalog this size belongs — the revalidation window is the one
 * decision left, and it wants a real project to measure against.
 *
 * The slug is **per locale** now (ADR-52), so the lookup is `(locale, slug)`.
 */
export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "product" });
  const product = await getProductBySlug(locale as Locale, slug);

  if (!product) return { title: t("notFound") };

  const activeLocale = locale as Locale;
  const description = product.shortDescription[activeLocale];

  return {
    title: product.name[activeLocale],
    description,
    // Per-page canonical and `hreflang`, never on the root layout — a root
    // canonical would tell crawlers the whole catalog duplicates one URL
    // (ADR-15).
    alternates: localeAlternates(
      activeLocale,
      routes.catalog.detail(product.slug),
    ),
    openGraph: {
      title: product.name[activeLocale],
      description,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const activeLocale = locale as Locale;

  // Two different failures with two different answers. A slug that matches no
  // row is a 404 — `getProductBySlug` returns null and `notFound()` is raised
  // inside the wrapper, where `unstable_rethrow` lets it through untouched. An
  // unreachable catalog is not a 404, so it renders the unavailable state
  // rather than telling a crawler this product no longer exists (**K-19**).
  const data = await readCatalog(async () => {
    const product = await getProductBySlug(activeLocale, slug);
    if (!product) notFound();

    const [categories, siblings] = await Promise.all([
      listCategories(activeLocale),
      listProductsByCategory(activeLocale, product.category),
    ]);

    return { product, categories, siblings };
  });

  if (!data) return <CatalogUnavailable />;

  const { product, categories, siblings } = data;

  const [t, tCommon] = await Promise.all([
    getTranslations("product"),
    getTranslations("common"),
  ]);

  const isOutOfStock = getStockLevel(product.stock) === "out-of-stock";
  const related = siblings.filter((p) => p.slug !== product.slug).slice(0, 4);

  const categoryName =
    categories.find((c) => c.slug === product.category)?.name[activeLocale] ??
    product.category;

  // Specs arrive flat and are grouped for display, matching how
  // `product_specifications.spec_group` is stored.
  const specGroups = product.specs.reduce<Record<string, typeof product.specs>>(
    (groups, spec) => {
      const key = spec.group ?? "general";
      (groups[key] ??= []).push(spec);
      return groups;
    },
    {},
  );

  return (
    <Container className="py-8 sm:py-12">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="mb-6 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={routes.home} className="hover:text-foreground">
              {t("home")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={routes.catalog.index} className="hover:text-foreground">
              {t("products")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={routes.catalog.byCategory(product.category)}
              className="hover:text-foreground"
            >
              {categoryName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {product.name[activeLocale]}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImage
          name={product.imageAlt[activeLocale]}
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
              {product.name[activeLocale]}
            </h1>
            <p className="text-pretty text-muted-foreground">
              {product.shortDescription[activeLocale]}
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
              {isOutOfStock ? tCommon("outOfStock") : tCommon("addToBasket")}
            </Button>
            <Button size="lg" variant="outline" disabled>
              <Heart aria-hidden="true" />
              {tCommon("save")}
            </Button>
          </div>

          <ul className="grid gap-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              {t("warrantyYears", { years: product.warrantyMonths / 12 })}
            </li>
            <li className="flex items-center gap-2">
              <Truck className="size-4 shrink-0" aria-hidden="true" />
              {t("freeDelivery", {
                amount: formatPrice(
                  FREE_DELIVERY_THRESHOLD_CENTS,
                  activeLocale,
                ),
              })}
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
            {t("about")}
          </h2>
          <p className="text-pretty text-muted-foreground">
            {product.description[activeLocale]}
          </p>
        </section>

        <section aria-labelledby="specs-heading">
          <h2
            id="specs-heading"
            className="mb-3 text-xl font-semibold tracking-tight"
          >
            {t("specifications")}
          </h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {t("specsCaption", { name: product.name[activeLocale] })}
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
                        {t(`specs.groups.${group}`)}
                      </th>
                    </tr>
                    {specs.map((spec) => (
                      <tr key={`${group}-${spec.name}`} className="border-t">
                        <th
                          scope="row"
                          className="w-1/2 px-4 py-2.5 text-start font-normal text-muted-foreground"
                        >
                          {t(`specs.names.${spec.name}`)}
                        </th>
                        <td className="px-4 py-2.5 font-medium">
                          {/* Identifiers stay literal; prose values carry all
                              three languages. See `ProductSpec`. */}
                          {typeof spec.value === "string"
                            ? spec.value
                            : spec.value[activeLocale]}
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
            {t("related", { category: categoryName })}
          </h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </Container>
  );
}
