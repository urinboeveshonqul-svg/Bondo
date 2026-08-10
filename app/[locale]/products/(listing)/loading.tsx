import { ProductGridSkeleton } from "@/components/commerce/product-card-skeleton";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for the catalog listing.
 *
 * Scoped to this segment rather than the root: the home page is static and a
 * root `loading.tsx` would flash a fallback on every navigation for no benefit
 * (ADR-18). The listing does real work per request — a category tree, a
 * filtered product query, an exact count — so it is the first route that earns
 * one.
 *
 * ## Why it lives inside a `(listing)` route group
 *
 * A `loading.tsx` opens a Suspense boundary for its segment **and every route
 * beneath it**. Sitting one level up at `products/`, this one wrapped
 * `products/[slug]` too — so the detail route's response shell flushed with
 * **200** before the page body ran, and the `notFound()` inside it could no
 * longer change the status. Every unknown product slug answered 200 with
 * not-found copy: a soft 404, which invites dead product URLs into the search
 * index.
 *
 * That is exactly the failure ADR-41 recorded and solved with
 * `dynamicParams = false`; the guard was dropped when the detail route moved to
 * on-demand rendering, and the boundary came back with it. The group is the
 * structural fix rather than a second guard — `(listing)` is URL-transparent,
 * so `/products` is unchanged, and `[slug]` is now outside the boundary and
 * free to answer 404 (**ADR-81**).
 *
 * The block sizes mirror the real page's heading, filter row and grid, so the
 * layout does not move when content replaces this. It carries no text, which is
 * why it needs no translations: the skeleton is the same in every language.
 */
export default function ProductsLoading() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>

      <Skeleton className="mb-4 h-4 w-24" />

      <ProductGridSkeleton count={8} />
    </Container>
  );
}
