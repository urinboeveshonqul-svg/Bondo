"use server";

import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { passwordSchema } from "@/lib/auth/password";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { claimPendingOrders } from "@/lib/orders/claim";
import { routes } from "@/lib/routes";
import { createClient } from "@/supabase/server";
import * as authService from "@/services/auth.service";

/**
 * Authentication entry points.
 *
 * Every one goes through `createAction()`, so validation is not optional: a
 * Server Action is a public HTTP endpoint and the form is not the only thing
 * that can POST to it. No component calls Supabase, and no component calls
 * `services/auth.service.ts` directly — this file is the boundary (ADR-1).
 *
 * ## Error messages are keys, not sentences
 *
 * Actions return a **translation key** in `error`, and the form resolves it in
 * the `auth` namespace. A Server Action cannot know the visitor's locale without
 * being handed it, and threading a locale through every call so the server can
 * produce Uzbek prose puts translation in the wrong layer. The key is stable,
 * the copy is a translation decision (§ 11).
 *
 * ## Redirects happen in the component, not here
 *
 * `redirect()` from a Server Action throws a control-flow signal that
 * `createAction()` deliberately rethrows (ADR-13) — so calling it here would
 * work, but it would also mean the action can never report a *recoverable*
 * failure to the form it came from. Actions return data; the client decides
 * where to go. That also keeps `redirectTo` validation on the client boundary
 * where the value originates.
 */

/**
 * Turns a GoTrue failure into a translation key.
 *
 * `createAction()` returns `error.message` straight to the caller, and the
 * service layer speaks stable codes rather than copy (by design — see its
 * header). This is the one place that joins the two, so the services stay
 * untouched and no action hand-writes a sentence.
 */
const AUTH_FAILURE_KEYS: Record<authService.AuthFailure, string> = {
  invalid_credentials: "errors.invalidCredentials",
  email_taken: "errors.emailTaken",
  email_not_verified: "errors.emailNotVerified",
  weak_password: "errors.passwordTooWeak",
  expired_link: "errors.linkExpired",
  same_password: "errors.samePassword",
  rate_limited: "errors.rateLimited",
  unknown: "errors.unknown",
};

async function withAuthErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof authService.AuthError) {
      throw new AppError(error.code, AUTH_FAILURE_KEYS[error.failure], {
        cause: error,
      });
    }

    throw error;
  }
}

/**
 * The absolute origin, for the links Supabase emails.
 *
 * Read from the request headers rather than `NEXT_PUBLIC_SITE_URL`, because a
 * preview deployment has a hostname nothing can know at build time (ADR-16) and
 * a recovery link pointing at production from a preview is a link that signs
 * somebody into the wrong environment.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";

  if (!host)
    throw new AppError("internal", "Cannot determine the site origin.");

  return `${proto}://${host}`;
}

const emailSchema = z
  .string()
  .trim()
  .min(1, "errors.emailRequired")
  .email("errors.emailInvalid")
  // Stored lower-case so "Ali@x.com" and "ali@x.com" are one account. GoTrue
  // does this too; doing it here as well keeps the value we echo back in sync.
  .transform((value) => value.toLowerCase());

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "errors.nameRequired").max(200),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    // `literal(true)` rather than `boolean()`: the box must be ticked, and an
    // unchecked checkbox is absent from FormData rather than false.
    acceptTerms: z.literal(true, { message: "errors.termsRequired" }),
    redirectTo: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "errors.passwordsDoNotMatch",
  });

export const signUpAction = createAction(
  "auth.signUp",
  signUpSchema,
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const origin = await requestOrigin();
      const next = safeRedirectPath(input.redirectTo, routes.account.index);

      const result = await authService.signUp(supabase, {
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        emailRedirectTo: `${origin}${routes.auth.callback}?next=${encodeURIComponent(next)}`,
      });

      // The profile and the default wishlist are created by `handle_new_user()`
      // inside the signup transaction, not here (ADR-59). Nothing to follow up.
      return { email: input.email, hasSession: result.hasSession };
    }),
);

// -----------------------------------------------------------------------------
// Sign in
// -----------------------------------------------------------------------------

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "errors.passwordRequired"),
  /**
   * Remember me. Supabase's cookie lifetime is a project setting rather than a
   * per-request one, so this cannot shorten the session server-side; what it
   * does is decide whether the address is pre-filled next time. Recorded as
   * **D-22** — the honest version of the control, rather than a checkbox that
   * silently does nothing.
   */
  rememberMe: z.coerce.boolean().optional(),
  redirectTo: z.string().optional(),
});

export const signInAction = createAction(
  "auth.signIn",
  signInSchema,
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();

      await authService.signIn(supabase, {
        email: input.email,
        password: input.password,
      });

      const user = await authService.currentUser(supabase);

      // A shopper who ordered as a guest, tapped "Maybe later", and signs in a
      // week from now has the same claim as one who registered on the spot. The
      // callback covers registration; this covers everybody else. Never throws.
      const claimed = await claimPendingOrders();

      return {
        email: input.email,
        isVerified: authService.isEmailVerified(user),
        claimedOrders: claimed,
        redirectTo: safeRedirectPath(input.redirectTo, routes.account.index),
      };
    }),
);

export const signOutAction = createAction(
  "auth.signOut",
  z.object({}).optional(),
  async () =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      await authService.signOut(supabase);

      return { signedOut: true };
    }),
);

// -----------------------------------------------------------------------------
// Passwords
// -----------------------------------------------------------------------------

export const requestPasswordResetAction = createAction(
  "auth.requestPasswordReset",
  z.object({ email: emailSchema }),
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const origin = await requestOrigin();

      try {
        await authService.requestPasswordReset(supabase, {
          email: input.email,
          redirectTo: `${origin}${routes.auth.callback}?next=${encodeURIComponent(routes.auth.resetPassword)}`,
        });
      } catch (error) {
        // **The rate limit is swallowed here, and only here.** The service
        // surfaces it so a caller is not left clicking a dead button — but on
        // *this* endpoint it is an enumeration oracle: sending mail to a known
        // address consumes quota and errors, while an unknown address returns
        // cleanly because no mail is attempted. Measured against the live
        // project once its mail quota was exhausted, which is exactly when an
        // attacker would probe. The visitor still sees the confirmation, so
        // nothing is hidden from them that they could act on.
        if (
          !(error instanceof authService.AuthError) ||
          error.failure !== "rate_limited"
        ) {
          throw error;
        }

        logger.warn("password reset mail was rate limited", {
          // Never the address: this line ends up in a log aggregator.
          rateLimited: true,
        });
      }

      // Always the same answer, whether or not the address exists. See the
      // enumeration note in `services/auth.service.ts`.
      return { sent: true };
    }),
);

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "errors.passwordsDoNotMatch",
  });

/**
 * Completes a recovery.
 *
 * By the time this runs the callback has already exchanged the emailed code for
 * a real session, so this is an authenticated password change and there is no
 * token to trust. A visitor who arrives without that session gets `unauthorized`
 * rather than a form that appears to work.
 */
export const resetPasswordAction = createAction(
  "auth.resetPassword",
  resetPasswordSchema,
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const user = await authService.currentUser(supabase);

      if (!user)
        throw new AppError("unauthorized", "errors.resetSessionMissing");

      await authService.updatePassword(supabase, input.password);

      return { updated: true };
    }),
);

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "errors.passwordRequired"),
    password: passwordSchema,
    confirmPassword: z.string(),
    signOutEverywhere: z.coerce.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "errors.passwordsDoNotMatch",
  });

/**
 * Changes the password of a signed-in account.
 *
 * The current password is re-checked first. Supabase does not require it —
 * `updateUser` trusts the session — which means an unattended logged-in browser
 * is enough to lock the owner out of their own account. Asking is the difference
 * between a session compromise and an account takeover.
 */
export const changePasswordAction = createAction(
  "auth.changePassword",
  changePasswordSchema,
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const user = await authService.currentUser(supabase);

      if (!user?.email) {
        throw new AppError("unauthorized", "errors.notSignedIn");
      }

      const correct = await authService.verifyPassword(supabase, {
        email: user.email,
        password: input.currentPassword,
      });

      if (!correct) {
        throw new AppError("validation", "errors.currentPasswordWrong", {
          details: { currentPassword: ["errors.currentPasswordWrong"] },
        });
      }

      await authService.updatePassword(supabase, input.password);

      // Done last: signing out globally invalidates the session this request is
      // using, so anything after it would run unauthenticated.
      if (input.signOutEverywhere) {
        await authService.signOutEverywhere(supabase);
      }

      return {
        updated: true,
        signedOutEverywhere: Boolean(input.signOutEverywhere),
      };
    }),
);

// -----------------------------------------------------------------------------
// Email verification
// -----------------------------------------------------------------------------

export const resendVerificationAction = createAction(
  "auth.resendVerification",
  z.object({ email: emailSchema }),
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const origin = await requestOrigin();

      await authService.resendVerification(supabase, {
        email: input.email,
        redirectTo: `${origin}${routes.auth.callback}?next=${encodeURIComponent(routes.account.index)}`,
      });

      return { sent: true };
    }),
);

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "errors.nameRequired").max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{4,32}$/, "errors.phoneInvalid")
    .optional()
    .or(z.literal("")),
});

/**
 * Updates the signed-in user's own profile row.
 *
 * `id` comes from the validated session, never from the form. Taking it from
 * input would let anyone POST a different id — and while RLS would refuse the
 * write, an endpoint whose safety depends entirely on a policy being right is an
 * endpoint one migration away from being an authorisation bug.
 */
export const updateProfileAction = createAction(
  "auth.updateProfile",
  updateProfileSchema,
  async (input) =>
    withAuthErrors(async () => {
      const supabase = await createClient();
      const user = await authService.currentUser(supabase);

      if (!user) throw new AppError("unauthorized", "errors.notSignedIn");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: input.fullName,
          phone: input.phone === "" ? null : (input.phone ?? null),
        })
        .eq("id", user.id);

      if (error)
        throw new AppError("internal", "errors.profileUpdateFailed", {
          cause: error,
        });

      return { updated: true };
    }),
);
