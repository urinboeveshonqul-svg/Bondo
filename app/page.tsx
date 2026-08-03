import { BrandStrip } from "@/components/home/brand-strip";
import { Hero } from "@/components/home/hero";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { ProductGrid } from "@/components/home/product-grid";
import { Reviews } from "@/components/home/reviews";
import { ValueProps } from "@/components/home/value-props";
import { Section } from "@/components/layout/section";
import { routes } from "@/lib/routes";
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
 * at build time. The only JavaScript the visitor downloads is for the header's
 * interactive controls and the newsletter form — the sections themselves ship
 * as markup (ADR-6).
 *
 * Every section reads from `mocks/catalog` today. When the catalog service
 * lands, each `getProductsByCategory` call becomes an awaited service call and
 * nothing else on this page changes: the components are typed against
 * `types/catalog.ts`, not against the mock module.
 */
export default function HomePage() {
  const categoryRails = categories.map((category) => ({
    category,
    products: getProductsByCategory(category.slug),
  }));

  return (
    <>
      <Hero />

      <Section
        title="Featured this month"
        description="The systems and parts our build team reaches for first."
        href={routes.catalog.index}
        linkLabel="View all products"
      >
        <ProductGrid products={featuredProducts} />
      </Section>

      <BrandStrip brands={brands} />

      {categoryRails.map(({ category, products }, index) => (
        <Section
          key={category.slug}
          title={category.name}
          description={category.description}
          href={routes.catalog.byCategory(category.slug)}
          linkLabel={`All ${category.name.toLowerCase()}`}
          // Alternating surfaces separate the rails without adding rules.
          muted={index % 2 === 1}
        >
          <ProductGrid products={products} />
        </Section>
      ))}

      <Section
        title="Today's deals"
        description="Current promotions. Prices return to list when the promotion ends."
        href={routes.catalog.index}
        linkLabel="View all products"
        muted
      >
        <ProductGrid
          products={dealProducts}
          emptyTitle="No promotions running"
          emptyDescription="Nothing is discounted right now. Check back — deals rotate monthly."
        />
      </Section>

      <ValueProps />

      <Reviews reviews={reviews} />

      <NewsletterSection />
    </>
  );
}
