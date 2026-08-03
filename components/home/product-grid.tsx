import { PackageSearch } from "lucide-react";

import { ProductCard } from "@/components/commerce/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";

/**
 * Responsive product grid.
 *
 * One component for every place products are listed — the home page rails, the
 * catalog listing and, later, search results — so the breakpoints and gaps are
 * defined once. Two columns on a phone rather than one: at 375px a single
 * column shows barely one product per screen, and scanning is the whole job of
 * a listing.
 *
 * Renders its own empty state, so no caller has to remember to handle zero
 * results. That is the case ADR-20 says gets forgotten when a catalog is always
 * populated with fake rows.
 */
export function ProductGrid({
  products,
  emptyTitle = "No products found",
  emptyDescription = "Try removing a filter or searching for something broader.",
  emptyAction,
  className,
}: {
  products: ProductSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed">
        <EmptyState
          icon={PackageSearch}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6",
        className,
      )}
    >
      {products.map((product) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
