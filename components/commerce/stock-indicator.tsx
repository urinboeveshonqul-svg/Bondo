import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/site-config";
import { getStockLevel } from "@/utils/catalog";
import { formatNumber } from "@/utils/format";

/**
 * Stock availability.
 *
 * Colour is never the only signal — each state also has distinct wording — so
 * the meaning survives a monochrome display or a red/green colour deficiency.
 *
 * The exact count is shown only in the "low" band. Publishing precise stock on
 * everything hands competitors a live inventory feed, and the shopper only
 * needs the number when scarcity is the decision.
 */
export function StockIndicator({
  stock,
  className,
}: {
  stock: number;
  className?: string;
}) {
  const t = useTranslations("common.stock");
  const locale = useLocale() as Locale;
  const level = getStockLevel(stock);

  const label =
    level === "out-of-stock"
      ? t("outOfStock")
      : level === "low"
        ? t("low", { count: formatNumber(stock, locale) })
        : t("inStock");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        level === "out-of-stock" && "text-muted-foreground",
        // Scarcity is emphasised with weight and wording, not hue. Orange is
        // reserved for price reductions across the whole system, and an orange
        // "Only 3 left" beside an orange sale price makes neither legible.
        level === "low" && "font-semibold text-foreground",
        level === "in-stock" && "text-success",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          level === "out-of-stock" && "bg-muted-foreground",
          level === "low" && "bg-foreground",
          level === "in-stock" && "bg-success",
        )}
      />
      {label}
    </span>
  );
}
