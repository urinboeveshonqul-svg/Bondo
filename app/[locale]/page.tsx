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
  listCategories,
  listDealProducts,
  listFeaturedProducts,
  listProductsByCategory,
  listRecentReviews,
  listServiceHighlights,
  readCatalog,
} from "@/services/catalog.reads";
import type { PageParams } from "@/types";

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
    const [categories, featured, deals, brands] = await Promise.all([
      listCategories(activeLocale),
      listFeaturedProducts(activeLocale),
      listDealProducts(activeLocale),
      listBrands(),
    ]);

    const rails = await Promise.all(
      categories.map(async (category) => ({
        category,
        products: await listProductsByCategory(activeLocale, category.slug),
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

      {rails.map(({ category, products }, index) => (
        <Section
          key={category.slug}
          id={category.slug}
          title={category.name[activeLocale]}
          description={category.description[activeLocale]}
          href={routes.catalog.byCategory(category.slug)}
          linkLabel={t("category.linkLabel", {
            category: category.name[activeLocale],
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
