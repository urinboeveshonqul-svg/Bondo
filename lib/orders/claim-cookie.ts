import "server-only";

import { cookies } from "next/headers";

/**
 * Where a guest's claim tokens live between placing an order and registering.
 *
 * **httpOnly**, so no script on the page can read a token — including a script
 * that got there through a dependency. **`sameSite: lax`**, so it survives the
 * return trip from an email verification link but is not sent on a
 * cross-site POST. **No `secure` in development only**, because localhost is
 * http and a secure cookie would silently never be set.
 *
 * Thirty days is the window in which somebody realistically comes back and
 * registers. After that the automatic link is gone and support attaches the
 * order by hand — which is the correct way for this to fail (see the migration).
 */
const COOKIE = "bondo.order_claims";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Matches the bound in `claim_orders`, so the cookie can never overflow it. */
const MAX_TOKENS = 20;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * The tokens this browser is holding.
 *
 * Parsed defensively: the cookie is user-writable, and a malformed value must
 * produce an empty list rather than an exception on a page that only wanted to
 * know whether to show an invitation.
 */
export async function readClaimTokens(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is string => typeof value === "string")
      .filter(isUuid)
      .slice(0, MAX_TOKENS);
  } catch {
    return [];
  }
}

/**
 * Remembers one more token, newest last.
 *
 * Appends rather than replaces: a guest can place two orders before deciding to
 * register, and both should end up in their history.
 */
export async function rememberClaimToken(token: string): Promise<void> {
  if (!isUuid(token)) return;

  const existing = await readClaimTokens();
  if (existing.includes(token)) return;

  const next = [...existing, token].slice(-MAX_TOKENS);

  (await cookies()).set(COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Forgets every token.
 *
 * Called after a successful claim. The tokens are already spent server-side, so
 * this is housekeeping rather than security — but leaving dead tokens in a
 * cookie means every later sign-in makes a pointless round trip.
 */
export async function clearClaimTokens(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
