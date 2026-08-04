/**
 * Where a post-authentication redirect is allowed to land.
 *
 * `redirectTo` travels through a query string and, for email links, through the
 * message itself — so by the time it is used it is untrusted input that has been
 * outside the application. An **open redirect on an authentication callback** is
 * worth more to an attacker than most: the link genuinely originates from this
 * domain, survives a security-aware reader's glance at the hostname, and lands
 * wherever they chose.
 *
 * Only same-site absolute paths pass. Rejected:
 *
 *   `https://evil.com`   — absolute, another origin
 *   `//evil.com`         — protocol-relative, resolves off-site
 *   `\\evil.com`         — backslashes, which some parsers normalise to `//`
 *   `evil`               — relative, resolves against whatever page is current
 *
 * It lives in `lib/` rather than beside the actions because a `"use server"`
 * module may export nothing but async functions, and because the callback route
 * needs it too — one rule, two callers, no copy.
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value === "") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;

  return value;
}
