import { Container } from "@/components/layout/container";
import type { Brand } from "@/types/catalog";

/**
 * Popular brands.
 *
 * Monograms rather than logo images: manufacturer logos are trademarked assets
 * with usage rules, and shipping approximations of them is a legal problem as
 * well as a design one. Real logos arrive as licensed uploads in the `brands`
 * Storage bucket.
 *
 * A plain grid, not a marquee. An auto-scrolling strip moves content away from
 * anyone reading it and needs a pause control to meet WCAG 2.2.2.
 */
export function BrandStrip({ brands }: { brands: Brand[] }) {
  return (
    <section aria-labelledby="brands-heading" className="border-y py-10">
      <Container>
        <h2
          id="brands-heading"
          className="mb-6 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Brands we stock
        </h2>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {brands.map((brand) => (
            <li
              key={brand.slug}
              className="flex flex-col items-center justify-center gap-1 rounded-lg bg-muted/50 px-3 py-4"
            >
              <span
                aria-hidden="true"
                className="text-lg font-semibold tracking-tight text-muted-foreground/60"
              >
                {brand.monogram}
              </span>
              <span className="text-xs font-medium">{brand.name}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
