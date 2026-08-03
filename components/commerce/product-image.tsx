import { cn } from "@/lib/utils";

/**
 * Product imagery placeholder.
 *
 * Deliberately a generated monogram tile rather than a stock photograph.
 *
 * A convincing fake photo of a real product is the one piece of mock data a
 * reviewer could mistake for finished work, and the one that would quietly ship
 * to production. A monogram is unmistakably provisional while still giving the
 * layout a real aspect ratio to reserve, so nothing shifts when photography
 * replaces it.
 *
 * When Supabase Storage is wired this becomes `next/image` pointed at
 * `product.image`, with the same wrapper and aspect ratio — the surrounding
 * layout does not change.
 */
export function ProductImage({
  name,
  brand,
  className,
  priority = false,
}: {
  name: string;
  brand: string;
  className?: string;
  /** Reserved for the LCP image once real photography lands. */
  priority?: boolean;
}) {
  // Deterministic per product, so a card does not change appearance between
  // renders or between server and client.
  const monogram = brand.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "relative flex aspect-4/3 items-center justify-center overflow-hidden bg-muted",
        className,
      )}
      data-priority={priority ? "" : undefined}
    >
      <span
        aria-hidden="true"
        className="text-4xl font-semibold tracking-tight text-muted-foreground/40 select-none"
      >
        {monogram}
      </span>
      {/* The product name is the accessible description of this region; the
          monogram itself carries no information. */}
      <span className="sr-only">{name}</span>
    </div>
  );
}
