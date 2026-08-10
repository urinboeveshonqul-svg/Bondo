import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// =============================================================================
// Environment preflight
// =============================================================================
// `next.config.ts` is evaluated before any application module, so it cannot
// import `lib/env.ts` — this is the one other place that reads `process.env`
// directly. `lib/env.ts` remains the authoritative contract; this runs earlier.
//
// Why it checks variables this file does not itself use: without it, a missing
// NEXT_PUBLIC_SUPABASE_ANON_KEY is not caught until Next.js collects page data,
// at which point `lib/env.ts` throws while the root layout is being imported.
// Next reports that as:
//
//     Failed to collect page data for /_not-found
//
// — which names an innocent file, says nothing about environment variables, and
// sends whoever is on call reading `app/not-found.tsx`. Checking here converts
// the same failure into a config error that names the variable before the build
// starts. The build still fails; it just stops lying about why.
//
// Keep this list in step with the client schema in `lib/env.ts`. If it drifts,
// the failure degrades back to the opaque message above — worse diagnostics,
// not a broken build, because `lib/env.ts` still enforces the real contract.
// =============================================================================

/**
 * `URL.canParse` is not a strict enough test on its own. It accepts any scheme,
 * so it says yes to `postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres`
 * — the database connection string, which Supabase's dashboard shows a few
 * centimetres from the project URL and which people paste by mistake. It also
 * accepts `htp://typo` and `foo:bar`, the latter parsing to an empty hostname
 * and yielding a `remotePatterns` entry that silently matches nothing.
 */
function describeUrlProblem(value: string): string | null {
  if (!URL.canParse(value)) {
    return "is not a URL — it must include the scheme";
  }

  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return `has scheme "${url.protocol.replace(":", "")}", expected http or https — this looks like a connection string rather than a project URL`;
  }
  if (!url.hostname) {
    return "has no hostname";
  }
  return null;
}

/**
 * A value pasted into Vercel's form can carry a trailing newline. It survives
 * every truthiness and length check, so the build succeeds and the credential is
 * quietly wrong at runtime — which then presents as an auth or RLS bug. It is
 * reported rather than trimmed away, because silently repairing input hides the
 * mistake from the person who can fix it at source.
 */
function hasSurroundingWhitespace(value: string): boolean {
  return value !== value.trim();
}

type EnvVar = {
  name: string;
  value: string | undefined;
  required: boolean;
  kind: "url" | "opaque";
  /** Why the build needs it, or what happens when an optional one is absent. */
  note: string;
};

/**
 * Validates every public variable and reports all problems at once, so a
 * deployment missing two is one round trip rather than two.
 *
 * @returns the validated `NEXT_PUBLIC_SUPABASE_URL`.
 */
function preflightEnv(): string {
  const vars: EnvVar[] = [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      required: true,
      kind: "url",
      note: "next/image cannot allow-list the Supabase Storage host without it, and every product image would fail to load",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      required: true,
      kind: "opaque",
      note: "every Supabase client needs it, so the root layout fails to import and no page can render",
    },
    {
      name: "NEXT_PUBLIC_SITE_URL",
      value: process.env.NEXT_PUBLIC_SITE_URL,
      required: false,
      kind: "url",
      note: "optional — falls back to NEXT_PUBLIC_VERCEL_URL, then localhost",
    },
  ];

  const status: string[] = [];
  const problems: string[] = [];

  for (const v of vars) {
    const raw = v.value;

    if (raw === undefined || raw === "") {
      status.push(`${v.name.padEnd(30)} ${v.required ? "MISSING" : "not set"}`);
      if (v.required) problems.push(`${v.name} is not set — ${v.note}.`);
      continue;
    }

    const issues: string[] = [];
    if (hasSurroundingWhitespace(raw)) {
      issues.push(
        "has leading or trailing whitespace (check for a stray newline)",
      );
    }
    if (v.kind === "url") {
      const urlProblem = describeUrlProblem(raw.trim());
      if (urlProblem) issues.push(urlProblem);
    }

    if (issues.length === 0) {
      status.push(`${v.name.padEnd(30)} ok (${raw.length} chars)`);
    } else {
      status.push(`${v.name.padEnd(30)} INVALID`);
      // The URLs are not secrets and seeing the value is most of the diagnosis.
      // The anon key is public by design but still not worth echoing into a log.
      const shown = v.kind === "url" ? ` ${JSON.stringify(raw)}` : "";
      problems.push(`${v.name}${shown} ${issues.join(", and ")}.`);
    }
  }

  if (problems.length > 0) {
    // The status block comes first so a truncated log still answers "which one".
    throw new Error(
      `Environment is not configured for a build.\n\n` +
        status.map((s) => `  ${s}`).join("\n") +
        `\n\n` +
        problems.map((p) => `  • ${p}`).join("\n\n") +
        `\n\n` +
        `  Expected: NEXT_PUBLIC_SUPABASE_URL  https://<project-ref>.supabase.co\n` +
        `            NEXT_PUBLIC_SITE_URL      https://your-domain.com (or unset)\n\n` +
        `  Locally: copy .env.example to .env.local and fill it in.\n` +
        `  On Vercel: Project -> Settings -> Environment Variables. Set them for\n` +
        `  every environment you deploy (Production, Preview, Development), then\n` +
        `  redeploy. See PROJECT_STATUS.md section "Environment variables".`,
    );
  }

  // Non-null and valid after the checks above.
  return (process.env.NEXT_PUBLIC_SUPABASE_URL as string).trim();
}

const supabaseHostname = new URL(preflightEnv()).hostname;

/**
 * Security headers applied to every response.
 *
 * A Content-Security-Policy is deliberately not set here: Next.js needs a
 * per-request nonce for its inline bootstrap scripts, so CSP belongs in
 * `middleware.ts` where a nonce can be generated. That lands with the checkout
 * work, where it actually matters.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Surfaces unsafe lifecycles and side effects by double-rendering in dev.
  reactStrictMode: true,

  // Do not advertise the framework to attackers.
  poweredByHeader: false,

  // One canonical form per URL: /about, never /about/.
  trailingSlash: false,

  images: {
    // AVIF first, WebP as fallback — both far smaller than JPEG at equal quality.
    formats: ["image/avif", "image/webp"],
    // Product images are served from Supabase Storage. Remote hosts must be
    // allow-listed explicitly or `next/image` refuses to optimise them — an
    // open allow-list would let anyone use this deployment as a free image CDN.
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  experimental: {
    // Lets `app/global-not-found.tsx` render its own `<html>` and `<body>`.
    //
    // Next applies neither `app/layout.tsx` nor `app/[locale]/layout.tsx` to a
    // `not-found.tsx`, so until this existed every 404 on the site rendered the
    // right localized copy inside the framework's bare fallback document —
    // `<html id="__next_error__">`, no `lang`, no font (**K-20**, ADR-82).
    globalNotFound: true,

    // Both are barrel packages: `lucide-react` re-exports ~1,500 icons and
    // `radix-ui` re-exports every primitive. Without this, importing one icon
    // or one `Slot` makes the bundler walk the whole module graph. This rewrites
    // those imports to per-module paths.
    optimizePackageImports: ["lucide-react", "radix-ui"],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * Wires `i18n/request.ts` into the App Router so Server Components can resolve
 * the active locale and its messages without every page threading them down by
 * hand. The path is passed explicitly rather than relying on the convention,
 * because the default lookup is silent when it misses and the resulting failure
 * ("no locale was returned from `getRequestConfig`") names neither file.
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
