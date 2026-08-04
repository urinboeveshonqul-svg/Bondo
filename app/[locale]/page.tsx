import { useLocale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { BrandStrip } from "@/components/home/brand-strip";
import { Hero } from "@/components/home/hero";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { ProductGrid } from "@/components/home/product-grid";
import { Reviews } from "@/components/home/reviews";
import { ValueProps } from "@/components/home/value-props";
import { Section } from "@/components/layout/section";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams } from "@/types";
import {
  brands,
  categories,
  dealProducts,
  featuredProducts,
  getProductsByCategory,
  reviews,
} from "@/mocks/catalog";

/**
 * Home page.
 *
 * A Server Component with no data dependencies, so it prerenders as static HTML
 * at build time — once per locale, three times in total. The only JavaScript the
 * visitor downloads is for the header's interactive controls and the newsletter
 * form; the sections themselves ship as markup (ADR-6).
 *
 * Every section reads from `mocks/catalog` today. When the catalog service
 * lands, each `getProductsByCategory` call becomes an awaited service call and
 * nothing else on this page changes: the components are typed against
 * `types/catalog.ts`, not against the mock module.
 */
export default async function HomePage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;

  // Keeps this page static rather than dynamic. Without it, reading a
  // translation below opts the whole route into dynamic rendering.
  setRequestLocale(locale);

  return <HomeSections />;
}

/**
 * Split out because the sections read translations with `useTranslations`,
 * which is a hook and cannot be called from the `async` component above.
 */
function HomeSections() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const categoryRails = categories.map((category) => ({
    category,
    products: getProductsByCategory(category.slug),
  }));

  return (
    <>
      <Hero />

      <Section
        id="featured"
        title={t("featured.title")}
        description={t("featured.description")}
        href={routes.catalog.index}
        linkLabel={tCommon("viewAllProducts")}
      >
        <ProductGrid products={featuredProducts} />
      </Section>

      <BrandStrip brands={brands} />

      {categoryRails.map(({ category, products }, index) => (
        <Section
          key={category.slug}
          // The slug, not the translated name: a section id has to be stable
          // across languages, and `category.name[locale]` would produce a
          // different anchor per locale for the same section.
          id={category.slug}
          title={category.name[locale]}
          description={category.description[locale]}
          href={routes.catalog.byCategory(category.slug)}
          // Uzbek and Russian both inflect the category name after "All", and
          // lowercasing it is an English-only convention — so the whole phrase
          // is a translated template rather than a concatenation.
          linkLabel={t("category.linkLabel", {
            category: category.name[locale],
          })}
          // Alternating surfaces separate the rails without adding rules.
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
          products={dealProducts}
          emptyTitle={t("deals.emptyTitle")}
          emptyDescription={t("deals.emptyDescription")}
        />
      </Section>

      <ValueProps />

      <Reviews reviews={reviews} />

      <NewsletterSection />
    </>
  );
}
