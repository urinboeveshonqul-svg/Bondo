import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Relative, not the `@/` alias used everywhere else — see ADR-34.
//
// This file is reachable from `middleware.ts`, and Vercel resolves the whole
// middleware import graph itself when packaging the Edge Function, from source,
// without applying tsconfig `paths`. Anything it cannot resolve is reported as
// a missing module and fails the deployment:
//
//     The Edge Function "middleware" is referencing unsupported modules:
//     - supabase/session.js: @/lib/env, @/lib/routes
//
// The rule is therefore: **every module reachable from middleware.ts imports by
// relative path.** It applies transitively — fixing only the entry moved the
// error one level down to exactly this file.
//
// `../types/database` is a type-only import and is erased before anything
// resolves it, so it was never named in that error. It follows the same rule
// anyway: the distinction is invisible at a glance, and one edit turning it into
// a value import would break the deployment for a reason nobody would connect to
// this line.
import {
  isProtectedRoute,
  localizePath,
  routes,
  splitLocale,
} from "../lib/routes";
import type { Database } from "../types/database";

/**
 * Read directly from `process.env` instead of importing `lib/env.ts` — ADR-35,
 * the same reasoning as ADR-8 for `lib/logger.ts`, applied to the Edge bundle.
 *
 * `lib/env.ts` validates the whole public contract with Zod **at module scope
 * and throws on failure**. Importing it here has three consequences, all bad for
 * middleware:
 *
 *  1. Middleware validates `NEXT_PUBLIC_SITE_URL`, which nothing in this chain
 *     uses. Worse, that variable is *not* inlined into the Edge bundle when it
 *     is unset at build time — it stays a runtime `process.env` read, so its
 *     value can differ between build and runtime.
 *  2. A throw at module scope in an Edge Function is not one failed request. The
 *     module is evaluated once per isolate, so it fails *every* request, and
 *     Vercel surfaces it only as `MIDDLEWARE_INVOCATION_FAILED`.
 *  3. Zod ships in the Edge bundle, paying for a parser on every cold start.
 *
 * These two variables are the only ones this chain needs, and both are inlined
 * as literals at build time — verified by grepping the emitted bundle — so
 * there is nothing left to validate at runtime. `next.config.ts` already
 * preflights their presence before the build starts.
 *
 * `lib/env.ts` remains the contract for every other consumer.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase stores its session in cookies named `sb-<project-ref>-auth-token`,
 * chunked with a `.0`/`.1` suffix when the JWT is large.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = request.nextUrl.clone();
  const { pathname, search } = request.nextUrl;
  const { locale, pathname: unprefixed } = splitLocale(pathname);

  // Sent to the sign-in page *in the language they were already reading*.
  // `routes.auth.signIn` is unprefixed, so without this the gate would drop a
  // Russian shopper onto the Uzbek sign-in form.
  signInUrl.pathname = localizePath(locale, routes.auth.signIn);
  signInUrl.search = "";

  // **`redirectTo` is stored without its locale prefix** (**K-24**). It used to
  // keep one, and every consumer then added a second: `signInAction` hands the
  // value to `router.push()` from `@/i18n/navigation`, which prefixes whatever
  // it is given, so `/uz/account` became `/uz/uz/account` and a visitor who
  // signed in from the footer's account link landed on a 404. Sign-in itself
  // succeeded, which is why it read as a broken link rather than a broken login.
  //
  // Unprefixed is the project's convention everywhere else — `lib/routes.ts`
  // carries no locale and `lib/auth/guards.ts` already passes bare `routes.*`
  // values here. Nothing is lost by dropping it: the visitor is on a localized
  // sign-in page, so the router re-adds the locale they are actually reading.
  signInUrl.searchParams.set("redirectTo", `${unprefixed}${search}`);

  return NextResponse.redirect(signInUrl);
}

/**
 * Transplants the locale routing decision onto a response built by this module.
 *
 * Two middlewares both want to own the outgoing response: next-intl decides
 * *which page renders* (a rewrite to `/[locale]/…`) and this module decides
 * *which cookies go back* (a rotated auth token). Returning either one alone
 * loses the other's work — the visitor either gets no locale or gets logged out.
 *
 * The base is deliberately this module's `NextResponse.next({ request })`, not
 * next-intl's response, because only that form carries the request-header
 * overrides that let the *current* request's Server Components see the refreshed
 * cookies. So the three things next-intl actually produces are copied across
 * explicitly, and its request-header overrides are dropped rather than allowed
 * to clobber Supabase's:
 *
 *  - `x-middleware-rewrite`, the internal rewrite to the locale segment;
 *  - `link`, the `hreflang` alternates next-intl emits as a header;
 *  - cookies, which is where `NEXT_LOCALE` is persisted.
 *
 * A blanket header copy is what this avoids. `x-middleware-override-headers`
 * and `x-middleware-request-*` are Next.js's private channel for the mutated
 * request, and overwriting them with next-intl's copy drops the rotated auth
 * cookie — a random-logout bug with no stack trace.
 */
function inheritLocaleRouting(
  response: NextResponse,
  i18n: NextResponse,
): NextResponse {
  const rewrite = i18n.headers.get("x-middleware-rewrite");
  if (rewrite) response.headers.set("x-middleware-rewrite", rewrite);

  const link = i18n.headers.get("link");
  if (link) response.headers.set("link", link);

  for (const cookie of i18n.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return response;
}

/**
 * Refreshes the Supabase auth session on matched requests.
 *
 * Supabase access tokens are short-lived and Server Components cannot write
 * cookies, so without this the token would silently expire and users would be
 * logged out mid-session. Running it in middleware rotates the token and writes
 * the new cookies onto the outgoing response.
 *
 * Anonymous requests skip the Supabase round trip entirely. On a storefront the
 * large majority of traffic — every crawler and every logged-out shopper — has
 * no auth cookie, and there is nothing to refresh for them. Calling `getUser()`
 * anyway would add a network round trip to Supabase Auth on every page view,
 * which is both the dominant latency cost in middleware and a per-request
 * charge against the project's auth quota.
 *
 * @param i18n the response next-intl produced for this request. It already
 * carries the locale rewrite and the `NEXT_LOCALE` cookie; anonymous requests
 * are handed it back unchanged, which is both the cheapest path and the one that
 * cannot get the merge wrong.
 */
export async function updateSession(request: NextRequest, i18n: NextResponse) {
  const { pathname } = request.nextUrl;

  if (!hasAuthCookie(request)) {
    if (isProtectedRoute(pathname)) {
      return redirectToSignIn(request);
    }
    return i18n;
  }

  let response = inheritLocaleRouting(NextResponse.next({ request }), i18n);

  // Checked here rather than at module scope: a module-scope throw in an Edge
  // Function fails every request for the life of the isolate, which is the
  // failure this file was refactored to make impossible. Unreachable in
  // practice — both values are inlined at build and preflighted by
  // `next.config.ts` — but if it ever fires, one request fails loudly with a
  // message that names the cause instead of the whole deployment going dark.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase environment is missing in the Edge runtime: " +
        `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL ? "set" : "MISSING"}, ` +
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY ? "set" : "MISSING"}.`,
    );
  }

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          // Rebuilt so the mutated request cookies reach this request's Server
          // Components — and re-inherited, because rebuilding drops the locale
          // rewrite that was transplanted onto the previous instance.
          response = inheritLocaleRouting(NextResponse.next({ request }), i18n);

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not insert logic between `createServerClient` and `getUser()`: anything
  // that returns early here drops the rotated cookies and logs the user out at
  // random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A stale or revoked cookie lands here. Redirect rather than serve the page,
  // but keep the response's cleared cookies by copying them onto the redirect.
  if (!user && isProtectedRoute(pathname)) {
    const redirect = redirectToSignIn(request);

    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }

    return redirect;
  }

  return response;
}
