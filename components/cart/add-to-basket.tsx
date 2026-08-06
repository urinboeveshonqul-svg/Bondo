"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ShoppingCart } from "lucide-react";

import { useCart, type CartLine } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";

/**
 * Puts a product in the basket.
 *
 * The only client component on a product page, and it takes the line as a plain
 * prop so the page around it stays a Server Component — nothing about rendering
 * a product needs to reach the browser just because one button does.
 *
 * The confirmation is inline and brief rather than a toast: a shopper who taps
 * "add" is looking at the button, and a notification in the corner of the screen
 * is the wrong place to answer a question they asked with their thumb.
 */
export function AddToBasket({
  line,
  outOfStock = false,
  className,
}: {
  line: Omit<CartLine, "quantity">;
  outOfStock?: boolean;
  className?: string;
}) {
  const { add } = useCart();
  const t = useTranslations("common");
  const [justAdded, setJustAdded] = useState(false);

  if (outOfStock) {
    return (
      <Button disabled className={className}>
        {t("outOfStock")}
      </Button>
    );
  }

  return (
    <Button
      className={className}
      onClick={() => {
        add(line);
        setJustAdded(true);
        // Long enough to read, short enough that a second add still feels
        // responsive rather than queued behind an animation.
        window.setTimeout(() => setJustAdded(false), 1800);
      }}
    >
      {justAdded ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          {t("addedToBasket")}
        </>
      ) : (
        <>
          <ShoppingCart className="size-4" aria-hidden="true" />
          {t("addToBasket")}
        </>
      )}
    </Button>
  );
}
