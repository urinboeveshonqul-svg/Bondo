import "server-only";

import { notFound } from "next/navigation";

import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

import { routes } from "@/lib/routes";
import { createClient } from "@/supabase/server";
import type { Locale } from "@/lib/site-config";
import * as authService from "@/services/auth.service";
import {
  authorizationFor,
  type Authorization,
} from "@/services/authorization.service";

/**
 * Page-level authentication guards.
 *
 * Middleware already redirects an anonymous request away from a protected
 * prefix, and that is the cheap first gate. These are the second: middleware
 * proves a *session cookie* exists and is refreshable, and it deliberately does
 * not read the database (ADR-14), so it cannot answer "is this person verified"
 * or "is this person an administrator". Those questions need a query, and a
 * query belongs on the page.
 *
 * Neither gate is the authorisation boundary. RLS is (ADR-4).
 *
 * `redirect()` comes from `@/i18n/navigation`, so every redirect keeps the
 * visitor in the language they were reading.
 */

/** The signed-in user plus their resolved roles, or `null`. */
export async function currentSession(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof authService.currentUser>>>;
  authorization: Authorization;
  isVerified: boolean;
} | null> {
  const supabase = await createClient();
  const user = await authService.currentUser(supabase);

  if (!user) return null;

  return {
    user,
    authorization: await authorizationFor(supabase, user.id),
    isVerified: authService.isEmailVerified(user),
  };
}

/**
 * Requires a signed-in user, or redirects to sign-in carrying `redirectTo`.
 *
 * Used by every page under `/account`. Middleware will usually have caught the
 * anonymous case first; this covers the request whose cookie was revoked
 * between the Edge check and the render, and it is what makes the page correct
 * on its own terms rather than correct because something upstream is.
 */
export async function requireUser(currentPath: string = routes.account.index) {
  const session = await currentSession();
  const locale = (await getLocale()) as Locale;

  if (!session) {
    redirect({
      href: `${routes.auth.signIn}?redirectTo=${encodeURIComponent(currentPath)}`,
      locale,
    });
  }

  return session!;
}

/**
 * Requires an **active administrator**, and closes K-1.
 *
 * Three outcomes, and the difference between them matters:
 *
 *  - **not signed in** → sign-in, carrying `redirectTo`, because signing in is
 *    a thing they can do about it;
 *  - **signed in, not staff** → `notFound()`. A 403 confirms that `/admin`
 *    exists and is worth attacking; a 404 tells a signed-in customer who
 *    guessed the URL exactly what a wrong guess should tell them, which is
 *    nothing;
 *  - **deactivated administrator** → also 404, because `authorizationFor`
 *    resolves `is_active = false` to no roles at all.
 *
 * **This is not the boundary.** Every admin query is separately refused by RLS
 * through `has_permission()` (ADR-4). This stops an administrator wandering into
 * a screen they cannot use; it would not stop somebody who forged a session.
 */
export async function requireAdmin(currentPath: string = routes.admin.index) {
  const session = await currentSession();
  const locale = (await getLocale()) as Locale;

  if (!session) {
    redirect({
      href: `${routes.auth.signIn}?redirectTo=${encodeURIComponent(currentPath)}`,
      locale,
    });
  }

  if (!session!.authorization.isAdmin) notFound();

  return session!;
}

/**
 * Sends an already-authenticated visitor away from sign-in and sign-up.
 *
 * `redirectTo` is honoured so that a shopper who was bounced to sign-in, signed
 * in in another tab, and came back to this one still lands where they meant to.
 */
export async function redirectIfSignedIn(redirectTo?: string) {
  const session = await currentSession();
  if (!session) return;

  const locale = (await getLocale()) as Locale;
  const destination =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : routes.account.index;

  redirect({ href: destination, locale });
}
