import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";
import { claimPendingOrders } from "@/lib/orders/claim";
import { defaultLocale, isLocale } from "@/lib/site-config";
import { localizePath, routes } from "@/lib/routes";
import { createClient } from "@/supabase/server";
import * as authService from "@/services/auth.service";

/**
 * The single landing point for every Supabase email link.
 *
 * Signup confirmation, password recovery and any future magic link all arrive
 * here with a `code`, which is exchanged for a session and burned. One handler
 * rather than one per flow, because the exchange is identical and the part that
 * differs — where to go afterwards — is a query parameter.
 *
 * ## Why this route is not under `[locale]`
 *
 * The address in the email is generated server-side, at the moment the mail is
 * sent, by code that has a locale. But the *link* is clicked days later, possibly
 * on another device, and Supabase appends its own parameters to whatever URL it
 * was given. Keeping the callback locale-free means the email URL is stable and
 * this handler is not duplicated three times; the locale is carried in `next`
 * and restored on the redirect, falling back to the visitor's cookie.
 *
 * ## Failure is a redirect, never an error page
 *
 * An expired or replayed link is the single most common way somebody arrives
 * here, and it is not exceptional — it is Tuesday. Throwing would give them the
 * global error boundary (K-19); instead they land on the page that can actually
 * help, carrying a `reason` the page turns into a localized explanation and a
 * "send me another link" button.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), routes.account.index);

  // Supabase reports its own failures on the URL — an expired signup link
  // arrives as `?error=access_denied&error_code=otp_expired` with no code.
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");

  /**
   * The locale to answer in. `next` is already localized when it came from a
   * link this app generated; otherwise the cookie next-intl persists is the
   * best available signal, and the default is the last resort.
   */
  const segment = next.split("/")[1] ?? "";
  const locale = isLocale(segment)
    ? segment
    : isLocale(request.cookies.get("NEXT_LOCALE")?.value ?? "")
      ? (request.cookies.get("NEXT_LOCALE")!.value as typeof defaultLocale)
      : defaultLocale;

  const failure = (reason: string) => {
    const url = request.nextUrl.clone();
    url.pathname = localizePath(locale, routes.auth.verifyEmail);
    url.search = "";
    url.searchParams.set("reason", reason);

    return NextResponse.redirect(url);
  };

  if (errorCode) {
    logger.warn("auth callback rejected by Supabase", { errorCode });
    return failure(errorCode === "otp_expired" ? "expired" : "invalid");
  }

  if (!code) return failure("invalid");

  try {
    const supabase = await createClient();
    await authService.exchangeCodeForSession(supabase, code);

    // There is now a session, which is the first moment a guest order can be
    // attached to it. This is the reliable hook: a registration that requires
    // email confirmation has no session until the link is clicked, and the link
    // lands here. `claimPendingOrders` never throws — a failed claim must not
    // turn a successful verification into an error page.
    await claimPendingOrders();
  } catch (error) {
    logger.warn("auth callback could not exchange the code", {
      cause: error instanceof Error ? error.message : String(error),
    });

    return failure("expired");
  }

  // `next` is already locale-prefixed when this app built the link; a bare path
  // (the recovery link's `/reset-password`) is prefixed here.
  const destination = request.nextUrl.clone();
  destination.pathname = isLocale(segment) ? next : localizePath(locale, next);
  destination.search = "";

  return NextResponse.redirect(destination);
}
