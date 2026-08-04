"use client";

import { useTranslations } from "next-intl";
import { Heart, ShoppingCart } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * Basket and wishlist panels.
 *
 * These open a panel rather than navigating, which is deliberate on two counts.
 * It is what a premium storefront does — the shopper keeps their place — and it
 * means the header has no link to `/cart` or `/account/wishlist`, neither of
 * which exists yet. No dead links, and no disabled icon that does nothing.
 *
 * Both are empty because nothing can be added until the cart service lands in a
 * later phase, so the empty state is the honest state. It is real UI reachable
 * today, not a placeholder: exactly the case ADR-20 warns gets skipped when a
 * catalog is populated with fake rows.
 */
export function BasketSheet() {
  const t = useTranslations("header.basket");
  const tCommon = useTranslations("common");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("open")}>
          <ShoppingCart />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={ShoppingCart}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button asChild>
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
