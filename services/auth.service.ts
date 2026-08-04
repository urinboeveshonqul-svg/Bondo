import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Every call into Supabase Auth, in one place.
 *
 * Pages and actions never touch `supabase.auth` directly, for the same reason
 * they never touch `from()` directly (ADR-1): a sign-out written twice is a
 * sign-out that clears cookies in one place and forgets to in the other.
 *
 * **No custom authentication.** Passwords are hashed, compared, rotated and
 * rate-limited by GoTrue. Nothing here stores a credential, and nothing here
 * decides whether a password is correct — this module only shapes the questions
 * and translates the answers.
 *
 * ## Why the errors are re-mapped
 *
 * GoTrue returns messages written for a developer: `Invalid login credentials`,
 * `User already registered`, `Email not confirmed`. They are English-only, they
 * leak whether an address is registered, and they cannot be translated by a UI
 * that only sees a string. Each becomes an `AppError` with a **stable code**, so
 * the form looks up its own localized copy and the wording is a translation
 * decision rather than an upstream one.
 *
 * ## Enumeration
 *
 * `requestPasswordReset` and `resendVerification` resolve successfully whether
 * or not the address exists. An endpoint that answers "no such user" is an
 * endpoint that confirms which of a leaked address list holds accounts here.
 * The UI says "if that address has an account, we've sent a link", which is true
 * either way.
 */

/** Stable codes the UI maps to localized copy. */
export type AuthFailure =
  | "invalid_credentials"
  | "email_taken"
  | "email_not_verified"
  | "weak_password"
  | "expired_link"
  | "same_password"
  | "rate_limited"
  | "unknown";

export class AuthError extends AppError {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure, message: string, cause?: unknown) {
    super(failure === "rate_limited" ? "rate_limited" : "validation", message, {
      cause,
    });
    this.failure = failure;
  }
}

/**
 * Maps a GoTrue error onto a stable code.
 *
 * Matched on `code` first, which Supabase added precisely so callers stop
 * matching on prose, and on the message only as a fallback for the codes that
 * are still not populated. The default is `unknown` rather than a guess: a
 * misclassified error shows the wrong sentence to somebody who is already
 * stuck.
 */
function toAuthError(error: {
  message: string;
  code?: string;
  status?: number;
}): AuthError {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login")) {
    return new AuthError("invalid_credentials", "Invalid credentials.", error);
  }
  if (
    code === "user_already_exists" ||
    message.includes("already registered")
  ) {
    return new AuthError(
      "email_taken",
      "That address is already in use.",
      error,
    );
  }
  if (code === "email_not_confirmed" || message.includes("not confirmed")) {
    return new AuthError("email_not_verified", "Email not verified.", error);
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return new AuthError("weak_password", "Password too weak.", error);
  }
  if (code === "same_password" || message.includes("should be different")) {
    return new AuthError(
      "same_password",
      "Choose a different password.",
      error,
    );
  }
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return new AuthError("rate_limited", "Too many attempts.", error);
  }
  if (
    code === "otp_expired" ||
    message.includes("expired") ||
    message.includes("invalid token")
  ) {
    return new AuthError(
      "expired_link",
      "That link is no longer valid.",
      error,
    );
  }

  return new AuthError("unknown", "Authentication failed.", error);
}

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  /** Absolute URL the verification link returns to. */
  emailRedirectTo: string;
};

export type SignUpResult = {
  /** False when the project requires confirmation — the usual case. */
  hasSession: boolean;
};

/**
 * Registers an account.
 *
 * `full_name` goes into `raw_user_meta_data`, which the `handle_new_user`
 * trigger reads to populate the profile **inside the signup transaction**. That
 * is why the name is not written by a follow-up query: a second call can fail,
 * and a user with no profile is the orphan this phase exists to prevent.
 *
 * Supabase deliberately returns a *successful-looking* response for an address
 * that already exists but is unconfirmed, to avoid enumeration. That is fine:
 * the UI says "check your email" either way, which is what the real user needs
 * and what an attacker learns nothing from.
 */
export async function signUp(
  supabase: Client,
  input: SignUpInput,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.emailRedirectTo,
      data: { full_name: input.fullName },
    },
  });

  if (error) throw toAuthError(error);

  return { hasSession: data.session !== null };
}

// -----------------------------------------------------------------------------
// Sign in / out
// -----------------------------------------------------------------------------

export async function signIn(
  supabase: Client,
  input: { email: string; password: string },
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) throw toAuthError(error);
}

/**
 * Ends the session.
 *
 * `scope: "local"` clears this browser only. Signing a user out of every device
 * because they clicked "sign out" on one is a surprise, and the global variant
 * belongs behind an explicit "sign out everywhere" control on the security page.
 */
export async function signOut(supabase: Client): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw toAuthError(error);
}

/** The "sign out everywhere" the security page offers after a password change. */
export async function signOutEverywhere(supabase: Client): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw toAuthError(error);
}

// -----------------------------------------------------------------------------
// Passwords
// -----------------------------------------------------------------------------

/** Always resolves. See the enumeration note at the top of this file. */
export async function requestPasswordReset(
  supabase: Client,
  input: { email: string; redirectTo: string },
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  });

  // Rate limiting is the one failure worth surfacing: silently succeeding
  // teaches someone to keep clicking a button that is doing nothing.
  if (error && toAuthError(error).failure === "rate_limited") {
    throw toAuthError(error);
  }
}

/**
 * Sets a new password for the **currently authenticated** session.
 *
 * Used by both the reset flow and the security page. The reset link creates a
 * real session when it is exchanged, so there is one code path rather than two,
 * and no place where a token is trusted without GoTrue having validated it.
 */
export async function updatePassword(
  supabase: Client,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw toAuthError(error);
}

/**
 * Confirms the current password before a sensitive change.
 *
 * Supabase has no "verify password" endpoint, so this signs in again with the
 * same credentials — which is exactly the check, and which GoTrue rate-limits
 * like any other attempt. It refreshes the session rather than replacing it.
 */
export async function verifyPassword(
  supabase: Client,
  input: { email: string; password: string },
): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword(input);

  if (!error) return true;
  if (toAuthError(error).failure === "invalid_credentials") return false;

  throw toAuthError(error);
}

// -----------------------------------------------------------------------------
// Email verification
// -----------------------------------------------------------------------------

/** Always resolves for an unknown address. See the enumeration note. */
export async function resendVerification(
  supabase: Client,
  input: { email: string; redirectTo: string },
): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: input.email,
    options: { emailRedirectTo: input.redirectTo },
  });

  if (error && toAuthError(error).failure === "rate_limited") {
    throw toAuthError(error);
  }
}

/**
 * Exchanges the `code` on an email link for a session.
 *
 * Used by the callback route for every link type — signup confirmation,
 * password recovery, magic link. GoTrue validates and burns the code; an
 * expired or replayed one fails here rather than producing a half-session.
 */
export async function exchangeCodeForSession(
  supabase: Client,
  code: string,
): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw toAuthError(error);
}

/** The signed-in user, or `null`. Validates the JWT — never `getSession()` (ADR-5). */
export async function currentUser(supabase: Client) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/** Whether the address has been confirmed. `null` user reads as unverified. */
export function isEmailVerified(
  user: { email_confirmed_at?: string | null } | null,
) {
  return Boolean(user?.email_confirmed_at);
}
