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
// `@/types/database` was not named in that error because `import type` is
// erased before anything resolves it. It is converted anyway: the distinction
// is invisible at a glance, and one edit turning it into a value import would
// break the deployment for a reason nobody would connect to this line.
import { env } from "../lib/env";
import { isProtectedRoute, routes } from "../lib/routes";
import type { Database } from "../types/database";

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

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
