"use client";

import { useLocale, useTranslations } from "next-intl";
import { Heart, Minus, Plus, ShoppingCart, X } from "lucide-react";

import { useCart } from "@/components/cart/cart-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { formatPrice } from "@/utils/format";

/**
 * The basket panel.
 *
 * Opens beside the page rather than navigating, so a shopper adding a third item
 * keeps their place in the listing.
 *
 * The count badge renders only once the provider has read localStorage
 * (`ready`). Rendering it earlier would print `0` on the server and the real
 * number a tick later, which is a hydration mismatch and a visible flicker on
 * every page load.
 */
export function BasketSheet() {
  const t = useTranslations("header.basket");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const { lines, ready, itemCount, subtotalCents, setQuantity, remove } =
    useCart();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("open")}
          className="relative"
        >
          <ShoppingCart />
          {ready && itemCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground tabular-nums"
            >
              {itemCount > 9 ? "9+" : itemCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={ShoppingCart}
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              action={
                <SheetClose asChild>
                  <Button asChild>
                    <Link href={routes.catalog.index}>
                      {tCommon("browseProducts")}
                    </Link>
                  </Button>
                </SheetClose>
              }
            />
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-4">
              {lines.map((line) => (
                <li
                  key={`${line.productId}:${line.variantId ?? ""}`}
                  className="flex min-w-0 gap-3 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {line.sku}
                    </p>
                    <p className="mt-1 text-sm tabular-nums">
                      {formatPrice(line.unitPriceCents, locale)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={tCommon("card.removeFromBasket", {
                        name: line.name,
                      })}
                      onClick={() => remove(line.productId, line.variantId)}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>

                    <div className="flex items-center gap-1 rounded-md border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={tCommon("decreaseQuantity")}
                        onClick={() =>
                          setQuantity(
                            line.productId,
                            line.variantId,
                            line.quantity - 1,
                          )
                        }
                      >
                        <Minus className="size-3.5" aria-hidden="true" />
                      </Button>
                      <span className="min-w-6 text-center text-sm tabular-nums">
                        {line.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={tCommon("increaseQuantity")}
                        onClick={() =>
                          setQuantity(
                            line.productId,
                            line.variantId,
                            line.quantity + 1,
                          )
                        }
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {tCommon("subtotal")}
                </span>
                <span className="font-medium tabular-nums">
                  {formatPrice(subtotalCents, locale)}
                </span>
              </div>
              {/* Delivery is quoted on the call, per address (ADR-63), so the
                  basket shows a subtotal and says so rather than inventing a
                  total the shop would then have to walk back. */}
              <p className="text-xs text-muted-foreground">
                {tCommon("deliveryQuotedOnCall")}
              </p>
              <SheetClose asChild>
                <Button asChild className="w-full">
                  <Link href={routes.checkout}>{tCommon("checkout")}</Link>
                </Button>
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function WishlistSheet() {
  const t = useTranslations("header.wishlist");
  const tCommon = useTranslations("common");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("open")}>
          <Heart />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Heart}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button asChild variant="outline">
                <Link href={routes.catalog.index}>
                  {tCommon("browseProducts")}
                </Link>
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
