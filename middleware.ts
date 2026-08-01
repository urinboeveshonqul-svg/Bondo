import type { NextRequest } from "next/server";

import { updateSession } from "@/supabase/session";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Middleware runs on the Edge runtime and adds latency to every request it
   * matches, so it is excluded from anything that cannot carry a session:
   * Next.js internals, metadata routes, and static asset extensions.
   *
   * Kept as a negative lookahead rather than a list of positive matches because
   * a missed page means no token refresh — the failure mode of over-matching is
   * a few wasted microseconds, and of under-matching is random logouts.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot|css|js|map|txt|xml|json|pdf|mp4|webm)$).*)",
  ],
};
