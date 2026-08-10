import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrandStrip } from "@/components/home/brand-strip";
import { Hero } from "@/components/home/hero";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { ProductGrid } from "@/components/home/product-grid";
import { Reviews } from "@/components/home/reviews";
import { ServiceHighlights } from "@/components/home/service-highlights";
import { Section } from "@/components/layout/section";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import {
  listBrands,
  listCategoryNavigation,
  listDealProducts,
  listFeaturedProducts,
  listProductsByCategory,
  listRecentReviews,
  listServiceHighlights,
  readCatalog,
} from "@/services/catalog.reads";
import type { PageParams } from "@/types";

/**
 * How many department rails the landing page shows.
 *
 * A cap, not a target: the shop has twelve departments and a landing page that
 * scrolls through all of them is a catalog, not a shop window. Six is roughly
 * three screens of browsing before the deals band, which is where a visitor who
 * has not found what they want should be reaching for search or the menu
 * instead.
 */
const HOME_RAILS = 6;

/**
 * Home page.
 *
 * Every section now reads through `services/catalog.reads` — no page in the
 * storefront imports `mocks/` any more. The components below are unchanged:
 * the facade maps database rows onto the same view models they already took,
 * which is what `types/catalog.ts` existed to make possible.
 *
 * The rails are fetched **concurrently**. Sequential awaits would make the page
 * as slow as the sum of its sections rather than its slowest one.
 */
export default async function HomePage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activeLocale = locale as Locale;
  const [t, tCommon] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
  ]);

  // Outside `readCatalog` on purpose: the highlights are storefront chrome, and
  // losing them should cost the visitor a band of six cards rather than the
  // whole page. The reader already degrades to an empty list.
  const highlights = await listServiceHighlights();

  // Wrapped, because an exception escaping here does not reach
  // `app/[locale]/error.tsx` — it aborts the shell and Next replaces the whole
  // document with the global boundary (**K-19**). `null` means the catalog is
  // unreachable, which is a different thing from the catalog being empty.
  const data = await readCatalog(async () => {
    const [departments, featured, deals, brands] = await Promise.all([
      // The **twelve departments**, not all 102 categories. One rail per
      // category rendered 102 sections of roughly 494px each — a 54,000px home
      // page — and fired a product query per rail. Both are fixed by asking the
      // navigation tree for its top level, which is already memoised for the
      // header (**ADR-75**).
      listCategoryNavigation(activeLocale),
      listFeaturedProducts(activeLocale),
      listDealProducts(activeLocale),
      listBrands(),
    ]);

    /**
     * A rail is only worth a query if the department has something in it.
     *
     * `productCount` is the subtree total the navigation read already computed,
     * so this costs nothing and means an empty shop fetches nothing at all
     * rather than issuing twelve queries that each return zero rows.
     */
    const withStock = departments
      .filter((department) => department.productCount > 0)
      .slice(0, HOME_RAILS);

    const rails = await Promise.all(
      withStock.map(async (department) => ({
        department,
        products: await listProductsByCategory(activeLocale, department.slug),
      })),
    );

    return { featured, deals, brands, rails };
  });

  if (!data) return <CatalogUnavailable />;

  const { featured, deals, brands, rails } = data;

  return (
    <>
      <Hero />

      {/*
        Directly under the hero, because it answers the question a first-time
        visitor has before any product does: why buy from this shop at all. The
        content is `service_highlights` rows an operator edits — warranty, build
        time, delivery, assembly, testing, parts.
      */}
      <ServiceHighlights highlights={highlights} locale={activeLocale} />

      <Section
        id="featured"
        title={t("featured.title")}
        description={t("featured.description")}
        href={routes.catalog.index}
        linkLabel={tCommon("viewAllProducts")}
      >
        <ProductGrid products={featured} />
      </Section>

      <BrandStrip brands={brands} />

      {rails.map(({ department, products }, index) => (
        <Section
          key={department.slug}
          id={department.slug}
          title={department.name[activeLocale]}
          description={department.description[activeLocale]}
          href={routes.catalog.byCategory(department.slug)}
          linkLabel={t("category.linkLabel", {
            category: department.name[activeLocale],
          })}
          muted={index % 2 === 1}
        >
          <ProductGrid products={products} />
        </Section>
      ))}

      <Section
        id="deals"
        title={t("deals.title")}
        description={t("deals.description")}
        href={routes.catalog.index}
        linkLabel={tCommon("viewAllProducts")}
        muted
      >
        <ProductGrid
          products={deals}
          emptyTitle={t("deals.emptyTitle")}
          emptyDescription={t("deals.emptyDescription")}
        />
      </Section>

      {/*
        Real reviews or no reviews. `product_reviews` exists now
        (20260809001000), and it only accepts a row from a customer whose order
        reached `delivered` — so anything here was written by somebody who
        actually bought the product. Until one is, `Reviews` renders nothing at
        all rather than an empty state: a section headed "what customers say"
        with nothing under it advertises that nobody has said anything.
      */}
      <Reviews reviews={await listRecentReviews(activeLocale)} />

      <NewsletterSection />
    </>
  );
}
