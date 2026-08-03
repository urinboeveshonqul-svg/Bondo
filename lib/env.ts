import { z } from "zod";

/**
 * Environment contract.
 *
 * Everything the app needs from `process.env` is declared, parsed and typed
 * here. Parsing happens at module load, so a missing or malformed variable
 * fails the build/boot with a readable message instead of surfacing as
 * `undefined` deep inside a request.
 *
 * Two files read `process.env` outside this module, both deliberately:
 * `next.config.ts` (runs before the app and cannot import app modules) and
 * `lib/logger.ts` (imported by Client Components — see the note there).
 */

/**
 * A value pasted into a hosting provider's form can carry a trailing newline.
 * It passes every truthiness and length check, so the build succeeds and the
 * credential is quietly wrong at runtime — presenting later as an auth or RLS
 * bug rather than as a configuration mistake. Rejected rather than trimmed:
 * silently repairing input hides the error from the person who can fix it where
 * it was actually entered.
 */
const noSurroundingWhitespace = (value: string) => value === value.trim();
const whitespaceMessage = "must not have leading or trailing whitespace";

/**
 * `z.httpUrl()` rather than `z.url()`. The latter accepts any scheme, including
 * `postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres` — the database
 * connection string, which Supabase's dashboard displays beside the project URL
 * and which is a routine copy-paste mistake. It would otherwise validate here
 * and then fail obscurely at the first query.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .httpUrl({
      error:
        "NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL, e.g. https://<project-ref>.supabase.co",
    })
    .refine(noSurroundingWhitespace, whitespaceMessage),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required")
    .refine(noSurroundingWhitespace, whitespaceMessage),
  NEXT_PUBLIC_SITE_URL: z
    .httpUrl({
      error:
        "NEXT_PUBLIC_SITE_URL must be an http(s) URL, e.g. https://your-domain.com",
    })
    .refine(noSurroundingWhitespace, whitespaceMessage),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY must not be empty when set")
    .optional(),
});

/**
 * Resolves the canonical origin of this deployment.
 *
 * Vercel preview deployments get a generated hostname that cannot be known in
 * advance, so `NEXT_PUBLIC_SITE_URL` is not set for them. Without this fallback
 * every preview would emit production URLs in its canonical tags, Open Graph
 * metadata and auth redirects — pointing reviewers and crawlers at the wrong
 * deployment.
 *
 * Precedence: explicit setting → Vercel's per-deployment URL → localhost. Each
 * `process.env.NEXT_PUBLIC_*` access is spelled out in full because Next.js
 * only inlines the literal form.
 *
 * The localhost fallback is not gated on `NODE_ENV`: `next build` runs with
 * `NODE_ENV=production` even on a laptop, so gating it there would make the
 * variable mandatory for any local production build while the docs call it
 * optional. A deployment on Vercel always has `NEXT_PUBLIC_VERCEL_URL`, so the
 * only way to reach the localhost fallback in production is to self-host
 * without setting the variable — which warns loudly below.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit;

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
    console.warn(
      "[env] NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_VERCEL_URL are both unset in " +
        "a production build. Falling back to http://localhost:3000, which will " +
        "put localhost URLs in canonical tags, Open Graph metadata and auth " +
        "redirects. Set NEXT_PUBLIC_SITE_URL to the public origin.",
    );
  }

  return "http://localhost:3000";
}

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: resolveSiteUrl(),
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = parsed.data;

/**
 * Server-only variables. Reading these from a Client Component is a bug, so
 * they stay behind a function that throws when called in the browser.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }

  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) {
    throw new Error(
      `Invalid server environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
