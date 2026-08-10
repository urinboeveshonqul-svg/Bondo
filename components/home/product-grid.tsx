import { useTranslations } from "next-intl";
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
 *
 * The empty copy defaults to the generic catalog strings and is overridable by
 * callers that know something more specific — "Nothing matches “rtx”" beats "No
 * products found". Callers pass already-translated strings rather than keys, so
 * this component stays agnostic about which namespace the caller reads from.
 */
export function ProductGrid({
  products,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
}: {
  products: ProductSummary[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("catalog.empty");

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed">
        {/*
          Compact: this sits inside a listing that already has a heading, a
          category row and a filter panel around it, so it only has to say what
          happened. At full size it was 294px — a screen and a half on a phone.
        */}
        <EmptyState
          compact
          icon={PackageSearch}
          title={emptyTitle ?? t("defaultTitle")}
          description={emptyDescription ?? t("defaultDescription")}
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
