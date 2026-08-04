import { z } from "zod";

/**
 * The password contract, in one place.
 *
 * Shared by the Zod schemas on the server and the strength meter in the browser,
 * so a password the meter calls acceptable cannot be one the action rejects.
 * That divergence is the usual bug here, and it is infuriating: the form says
 * "strong", the submit says "too weak", and nothing says which rule was missed.
 *
 * **Length first, classes second.** Length is the property that actually
 * resists an offline attack; character classes mostly push people towards
 * `Password1!`. The floor is 10 rather than Supabase's default 6 — GoTrue
 * enforces its own minimum server-side regardless, and this is the stricter of
 * the two — with three of four classes required so a ten-character password is
 * not `aaaaaaaaaa`.
 *
 * No maximum below bcrypt's 72-byte input limit is imposed here beyond a sane
 * cap: rejecting a long passphrase is the wrong instinct.
 *
 * `lib/` and pure — no env, no Supabase, no React (§ 4).
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULES = [
  "length",
  "lowercase",
  "uppercase",
  "digit",
  "symbol",
] as const;

export type PasswordRule = (typeof PASSWORD_RULES)[number];

/** Which rules a candidate satisfies. Drives both validation and the meter. */
export function passwordRulesMet(value: string): Record<PasswordRule, boolean> {
  return {
    length:
      value.length >= PASSWORD_MIN_LENGTH &&
      value.length <= PASSWORD_MAX_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value),
  };
}

/** Three of the four character classes, plus the length floor. */
export function isStrongPassword(value: string): boolean {
  const met = passwordRulesMet(value);
  if (!met.length) return false;

  const classes = [met.lowercase, met.uppercase, met.digit, met.symbol].filter(
    Boolean,
  ).length;

  return classes >= 3;
}

/** 0–4, for the meter. Never a percentage: five buckets is what the UI shows. */
export function passwordScore(value: string): number {
  if (!value) return 0;

  const met = passwordRulesMet(value);
  const classes = [met.lowercase, met.uppercase, met.digit, met.symbol].filter(
    Boolean,
  ).length;

  let score = classes;
  // Length is worth more than a fourth character class, so a long passphrase
  // reads as strong even without a symbol.
  if (value.length >= PASSWORD_MIN_LENGTH + 6) score += 1;
  if (!met.length) score = Math.min(score, 1);

  return Math.min(score, 4);
}

/**
 * The Zod field every password input validates against.
 *
 * The message is a **translation key**, not a sentence: `createAction()` returns
 * field errors straight to the form, and the form looks each one up in the
 * `auth` namespace. Putting English here would be the one place in the codebase
 * where a user-facing string is hardcoded (§ 11).
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "errors.passwordTooShort")
  .max(PASSWORD_MAX_LENGTH, "errors.passwordTooLong")
  .refine(isStrongPassword, "errors.passwordTooWeak");
