"use client";

import Link from "next/link";
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
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open basket">
          <ShoppingCart />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your basket</SheetTitle>
          <SheetDescription>Items you are ready to buy.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={ShoppingCart}
            title="Your basket is empty"
            description="Browse the catalog and add something to get started."
            action={
              <Button asChild>
                <Link href={routes.catalog.index}>Browse products</Link>
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WishlistSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open wishlist">
          <Heart />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your wishlist</SheetTitle>
          <SheetDescription>
            Products you have saved for later.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Heart}
            title="Nothing saved yet"
            description="Save products from any card to compare them side by side later."
            action={
              <Button asChild variant="outline">
                <Link href={routes.catalog.index}>Browse products</Link>
              </Button>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
