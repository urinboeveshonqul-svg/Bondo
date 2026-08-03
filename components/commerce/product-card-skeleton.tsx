import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder for `ProductCard`.
 *
 * The block proportions match the real card — same aspect ratio, same number of
 * text lines — so the layout does not jump when data arrives. A skeleton whose
 * shape differs from its content is a worse experience than no skeleton at all,
 * because it moves twice.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="aspect-4/3 rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-1 h-3 w-24" />
        <Skeleton className="mt-2 h-6 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * A grid of skeletons. `count` should match the page size the real grid uses,
 * so the scroll height is right before and after loading.
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6"
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
