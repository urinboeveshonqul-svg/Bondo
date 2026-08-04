import { ProductGridSkeleton } from "@/components/commerce/product-card-skeleton";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading UI for the catalog listing.
 *
 * Scoped to this segment rather than the root: the home page is static and a
 * root `loading.tsx` would flash a fallback on every navigation for no benefit
 * (ADR-18). Listing is the first route that does real work per request —
 * filtering now, a database query shortly — so it is the first that earns one.
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
