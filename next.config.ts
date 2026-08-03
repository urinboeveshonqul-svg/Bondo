import type { NextConfig } from "next";

/**
 * Environment preflight.
 *
 * `next.config.ts` is evaluated before any application module, so it cannot
 * import `lib/env.ts` — this is the one other place that reads `process.env`
 * directly. `lib/env.ts` remains the authoritative contract; this is a preflight
 * that runs earlier.
 *
 * Why it checks variables this file does not itself use: without it, a missing
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not caught until Next.js collects page
 * data, at which point `lib/env.ts` throws while the root layout is being
 * imported. Next reports that as:
 *
 *     Failed to collect page data for /_not-found
 *
 * — which names an innocent file, says nothing about environment variables, and
 * sends whoever is on call reading `app/not-found.tsx`. Checking here converts
 * the same failure into a config error that names the variable before the build
 * starts. The build still fails; it just stops lying about why.
 *
 * Every problem is reported at once so a deployment missing two variables is
 * one round trip, not two.
 *
 * Keep this list in step with the client schema in `lib/env.ts`. If it drifts,
 * the failure degrades back to the opaque message above — bad diagnostics, not
 * a broken build, because `lib/env.ts` still enforces the real contract.
 */
function preflightEnv(): string {
  const problems: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!supabaseUrl) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_URL is not set. next/image cannot allow-list the " +
        "Supabase Storage host without it, and every product image would fail " +
        "to load at runtime.",
    );
  } else if (!URL.canParse(supabaseUrl)) {
    problems.push(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${JSON.stringify(supabaseUrl)}. ` +
        "It must include the scheme, e.g. https://<project-ref>.supabase.co",
    );
  }

  if (!anonKey) {
    problems.push(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Every Supabase client needs " +
        "it, so the root layout fails to import and no page can be rendered.",
    );
  }

  // Optional — but a value that is set and malformed is always a mistake, and
  // silently falling back would put localhost URLs in production metadata.
  if (siteUrl && !URL.canParse(siteUrl)) {
    problems.push(
      `NEXT_PUBLIC_SITE_URL is set but is not a valid absolute URL: ${JSON.stringify(siteUrl)}. ` +
        "It must include the scheme, e.g. https://bondo.example.com — or leave " +
        "it unset to fall back to the deployment URL.",
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Environment is not configured for a build.\n\n` +
        problems.map((p) => `  • ${p}`).join("\n\n") +
        `\n\nLocally: copy .env.example to .env.local and fill it in.\n` +
        `On Vercel: Project → Settings → Environment Variables, then redeploy.\n` +
        `See PROJECT_STATUS.md § Environment variables.`,
    );
  }

  // Non-null after the checks above.
  return supabaseUrl as string;
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

export default nextConfig;
