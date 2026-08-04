import type { NextRequest } from "next/server";

// Relative, not the `@/` alias used everywhere else in this codebase.
//
// Vercel does not only run this file through Next.js — it also inspects it with
// its own tooling when packaging the Edge Function, and that tooling resolves
// imports itself. When it cannot resolve one it reports:
//
//     The Edge Function "middleware" is referencing unsupported modules:
//     - middleware.js: @/supabase/session
//
// naming the specifier as though it were a missing npm package. A relative path
// needs no `paths` mapping from any resolver, so it removes that failure mode
// rather than depending on every tool in the chain reading tsconfig correctly.
//
// This is the only file in the project exempt from the `@/` convention, and the
// only one a third-party bundler parses directly — the same property that made
// a JSDoc comment in `export const config` break deploys (K-11).
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { updateSession } from "./supabase/session";

const handleI18n = createIntlMiddleware(routing);

/**
 * Two concerns share this one Edge entry point: deciding the visitor's language
 * and refreshing their Supabase session.
 *
 * Locale runs first, because its answer can end the request. A visit to `/` or
 * to a path with no locale prefix is answered with a redirect to `/uz`, `/ru` or
 * `/en`, and there is no reason to spend a Supabase round trip refreshing a
 * session for a response that renders nothing. The redirect re-enters this
 * middleware at the prefixed URL, where the session is refreshed normally.
 *
 * Everything else is handed to `updateSession`, which owns the merge — see
 * `inheritLocaleRouting` there for why the two responses cannot simply be
 * concatenated.
 */
export async function middleware(request: NextRequest) {
  const i18n = handleI18n(request);

  if (i18n.headers.has("location")) return i18n;

  return updateSession(request, i18n);
}

/**
 * Middleware runs on the Edge runtime and adds latency to every request it
 * matches, so it is excluded from anything that cannot carry a session:
 * Next.js internals, metadata routes, and static asset extensions.
 *
 * The matcher is a negative lookahead rather than a list of positive matches
 * because a missed page means no token refresh — the failure mode of
 * over-matching is a few wasted microseconds, and of under-matching is random
 * logouts.
 *
 * ---
 *
 * Keep this comment OUTSIDE the object literal, and put no `/** ... *\/` block
 * inside it.
 *
 * Vercel reads this export with `@vercel/static-config`, which pulls each
 * property apart positionally:
 *
 *     const [nameNode, _colon, valueNode] = prop.getChildren();
 *
 * A JSDoc block attached to a property becomes an extra leading child, so those
 * three names land on `[JSDoc, name, colon]` and the parser is handed the colon
 * as if it were the value. It then fails the whole deployment with:
 *
 *     Error: Unhandled type: "ColonToken" :
 *
 * which names neither this file nor the comment that caused it. Line comments
 * are trivia rather than child nodes, so they are safe if one is needed inline.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|bmp|woff|woff2|ttf|otf|eot|css|js|map|txt|xml|json|pdf|mp4|webm)$).*)",
  ],
};
