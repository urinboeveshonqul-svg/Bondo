import { useLocale, useTranslations } from "next-intl";
import { Heart, ShoppingCart } from "lucide-react";

import { DiscountBadge, Price } from "@/components/commerce/price";
import { ProductImage } from "@/components/commerce/product-image";
import { Rating } from "@/components/commerce/rating";
import { StockIndicator } from "@/components/commerce/stock-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/types/catalog";
import { getStockLevel } from "@/utils/catalog";

/**
 * Product card.
 *
 * A Server Component. The quick actions are the only interactive parts and they
 * are separate Client Components, so a grid of sixty cards ships the JavaScript
 * for the buttons once rather than sixty times (ADR-6).
 *
 * The whole card is one link, via a stretched overlay on the title rather than
 * wrapping everything in an anchor. Wrapping would nest the quick-action
 * buttons inside the anchor — invalid HTML, and it makes the accessible name of
 * the link the entire card contents. This way the link's name is the product
 * name, and the buttons stay siblings.
 */
export function ProductCard({
  product,
  className,
}: {
  product: ProductSummary;
  className?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const isOutOfStock = getStockLevel(product.stock) === "out-of-stock";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground",
        "transition-shadow duration-200 hover:shadow-lg",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
    >
      <div className="relative">
        <ProductImage
          name={product.imageAlt[locale]}
          brand={product.brand}
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />

        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          <DiscountBadge product={product} />
          {product.badges.map((badge) => (
            <Badge key={badge} variant="secondary">
              {t(`badges.${badge}`)}
            </Badge>
          ))}
        </div>

        {/* Quick actions. Hidden until hover on pointer devices, always present
            for keyboard and touch — `focus-within` on the card keeps them
            reachable when tabbed to, and `pointer-fine` scopes the hover-only
            behaviour to devices that can hover. */}
        <div
          className={cn(
            "absolute end-3 top-3 flex flex-col gap-2",
            "pointer-fine:opacity-0 pointer-fine:transition-opacity pointer-fine:duration-200",
            "group-focus-within:opacity-100 group-hover:opacity-100",
          )}
        >
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("card.saveToWishlist", { name: product.name })}
            disabled
          >
            <Heart />
          </Button>
          <Button
            variant="secondary"
            size="icon-sm"
            aria-label={t("card.addToBasket", { name: product.name })}
            disabled={isOutOfStock}
          >
            <ShoppingCart />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {product.brand}
        </p>

        <h3 className="text-sm leading-snug font-medium text-balance">
          <Link
            href={routes.catalog.detail(product.slug)}
            className="before:absolute before:inset-0 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>

        <Rating
          rating={product.rating}
          reviewCount={product.reviewCount}
          size="small"
        />

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <Price product={product} />
          <StockIndicator stock={product.stock} />
        </div>
      </div>
    </article>
  );
}
