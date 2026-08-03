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
import { isProtectedRoute, routes } from "../lib/routes";
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

  signInUrl.pathname = routes.auth.signIn;
  signInUrl.search = "";
  signInUrl.searchParams.set("redirectTo", `${pathname}${search}`);

  return NextResponse.redirect(signInUrl);
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
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasAuthCookie(request)) {
    if (isProtectedRoute(pathname)) return redirectToSignIn(request);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

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

          response = NextResponse.next({ request });

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
