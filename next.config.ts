import type { NextConfig } from "next";

/**
 * `next.config.ts` is evaluated before any application module, so it cannot
 * import `lib/env.ts` — this is the one other place that reads `process.env`
 * directly.
 *
 * Missing here is a build error rather than a fallback. An empty
 * `remotePatterns` list does not fail loudly: the build succeeds and every
 * product image 404s in production, which is exactly the class of bug that
 * reaches customers before it reaches a developer.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is not set. next/image cannot allow-list the " +
      "Supabase Storage host without it, and every product image would fail " +
      "to load at runtime. Copy .env.example to .env.local and fill it in.",
  );
}

const supabaseHostname = new URL(supabaseUrl).hostname;

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
