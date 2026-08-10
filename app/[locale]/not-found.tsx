import { NotFoundContent } from "@/components/shared/not-found-document";

/**
 * The 404 for `notFound()` raised by a route that matched — an unknown product
 * slug, or a `[locale]` segment that is not a locale.
 *
 * It renders content only. Next.js applies the **root** layout to a 404 and
 * nothing below it, so `app/layout.tsx` supplies the document and this file
 * must not (**K-20**, ADR-82). `app/global-not-found.tsx` covers the other
 * half: URLs that matched no route at all, which get no layout either.
 */
export default function NotFound() {
  return <NotFoundContent />;
}
