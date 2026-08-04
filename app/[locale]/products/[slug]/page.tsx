import { Fragment } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import { locales, type Locale } from "@/lib/site-config";
import {
  categories,
  getProductBySlug,
  getProductsByCategory,
  products,
} from "@/mocks/catalog";
import type { PageParams } from "@/types";
import type { Product } from "@/types/catalog";
import { getStockLevel } from "@/utils/catalog";
import { formatPrice } from "@/utils/format";

/** Free-delivery threshold, in integer minor units like every other amount. */
const FREE_DELIVERY_THRESHOLD_CENTS = 15000;

/**
 * Product detail.
 *
 * `generateStaticParams` prerenders every product in every locale at build time
 * — 12 products × 3 languages = 36 routes. That is right for a fixed mock set
 * and stays right for a real catalog of this size; at 50,000 products it becomes
 * `dynamicParams` with on-demand ISR, which is a change to this function alone.
 * Note that the multiplier is the reason the threshold arrives sooner than it
 * would have with one language.
 */
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.slug })),
  );
}

/**
 * A slug outside `generateStaticParams` is a 404, decided before rendering.
 *
 * This is not just an optimisation — it is what makes the status code correct.
 * `products/loading.tsx` puts a Suspense boundary above this route, so with
 * `dynamicParams` left at its default the response shell flushes with **200**
 * before the page body runs, and the `notFound()` below can no longer change
 * it. The visitor got the right page and Google got a soft 404: an unknown
 * product returning 200 invites the URL into the index.
 *
 * Refusing unknown params up front means Next.js answers 404 without starting
 * to stream. Correct for a fully prerendered catalog; when the catalog outgrows
 * build-time prerendering this becomes `true` plus on-demand ISR, and the soft
 * 404 has to be solved again — most likely by moving `loading.tsx` off this
 * route so nothing flushes before the lookup.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);
  const t = await getTranslations({ locale, namespace: "product" });

  if (!product) return { title: t("notFound") };

  const description = product.shortDescription[locale as Locale];

  return {
    title: product.name[locale as Locale],
    description,
    // Per-page canonical and `hreflang`, never on the root layout — a root
    // canonical would tell crawlers the whole catalog duplicates one URL
    // (ADR-15). The slug is shared across locales, so the same product in three
    // languages is three URLs that correctly point at each other.
    alternates: localeAlternates(
      locale as Locale,
      routes.catalog.detail(product.slug),
    ),
    openGraph: {
      title: product.name[locale as Locale],
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

  const product = getProductBySlug(slug);
  if (!product) notFound();

  return <ProductDetail product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const isOutOfStock = getStockLevel(product.stock) === "out-of-stock";
  const related = getProductsByCategory(product.category)
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  // The category's translated name, looked up by slug. The old code derived a
  // label from the slug itself (`"gaming-pcs".replace(/-/g, " ")`), which is
  // English-shaped and produced "gaming pcs" in all three languages.
  const categoryName =
    categories.find((c) => c.slug === product.category)?.name[locale] ??
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
            {product.name[locale]}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImage
          name={product.imageAlt[locale]}
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
              {product.name[locale]}
            </h1>
            <p className="text-pretty text-muted-foreground">
              {product.shortDescription[locale]}
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
                amount: formatPrice(FREE_DELIVERY_THRESHOLD_CENTS, locale),
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
            {product.description[locale]}
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
                {t("specsCaption", { name: product.name[locale] })}
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
                            : spec.value[locale]}
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
