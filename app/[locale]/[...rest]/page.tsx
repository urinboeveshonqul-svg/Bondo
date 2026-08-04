import { notFound } from "next/navigation";

/**
 * Catch-all that turns an unmatched URL into a localized 404.
 *
 * Without this, `/ru/nonsense` matches no route at all, so Next.js never enters
 * the `[locale]` segment and falls back to its own built-in 404 — an
 * unstyled English page with no `<html lang>`, outside the app shell. A
 * `not-found.tsx` inside the segment does not help, because that file only
 * catches `notFound()` raised by a route that *did* match.
 *
 * Matching everything here and immediately calling `notFound()` puts the
 * failure back inside the locale layout, so `app/[locale]/not-found.tsx`
 * renders with the header, the footer and the visitor's language.
 *
 * This is the least specific route in the tree, so it only ever runs when
 * nothing else matched.
 */
export default function CatchAllNotFound() {
  notFound();
}
