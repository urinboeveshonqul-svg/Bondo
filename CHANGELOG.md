# Changelog

All notable changes to Bondo are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until v1.0.0 the minor version tracks the phase: v0.1.0 is Phase 1, v0.2.0 is
Phase 2, and so on. v1.0.0 is the production launch at the end of Phase 9.

---

## [Unreleased]

Nothing yet. Phase 2 (Database & Authorization) has not started.

---

## [0.1.0] — 2026-08-01

**Phase 1 — Foundation.** Project scaffold, architectural boundaries and the
Supabase integration layer. No product features: the storefront is a home page
and a 404.

Reviewed before sign-off; 14 issues found and fixed (see
[Fixed](#fixed-during-phase-1-review)).

### Added

#### Toolchain

- Next.js 15.5.22 with the App Router, React 19.1.0, Turbopack for dev and build
- TypeScript 5 configured with `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames`, targeting ES2022
- Tailwind CSS 4 via `@tailwindcss/postcss`, design tokens in
  `styles/globals.css`
- shadcn/ui (`radix-nova` style, `neutral` base) pointed at `styles/globals.css`;
  `button`, `separator`, `skeleton` generated
- ESLint 9 flat config extending `next/core-web-vitals` and `next/typescript`,
  with `eslint-config-prettier` last; `no-console` enforced outside
  `lib/logger.ts`
- Prettier 3 with `prettier-plugin-tailwindcss` for canonical class ordering
- `npm run check` (typecheck + lint + format check) and db lifecycle scripts
- `.vscode/` workspace settings and extension recommendations
- `.gitattributes` pinning `eol=lf`. Git on Windows defaults to
  `core.autocrlf=true`, so without it a fresh clone checks out CRLF and
  `npm run check` fails on every file — including on a Windows CI runner
- Node engine requirement `>=20.9.0`; `allowScripts` approvals for `sharp` and
  `unrs-resolver`

#### Architecture

- Layered structure — `app/`, `components/`, `lib/`, `hooks/`, `types/`,
  `actions/`, `services/`, `utils/`, `supabase/`, `styles/`, `public/` — with a
  one-directional data flow: component → service → Supabase
- `lib/env.ts` — Zod-validated environment contract, parsed at module load
- `lib/routes.ts` — single source of truth for internal URLs, plus
  `protectedRoutePrefixes` and `isProtectedRoute()`
- `lib/errors.ts` — `AppError` with an eight-member code taxonomy and HTTP
  status mapping
- `lib/result.ts` — `Result<T>`, `ok()`, `err()` for trust boundaries
- `lib/logger.ts` — structured logger, JSON in production
- `lib/site-config.ts` — static site configuration with zero imports
- `actions/safe-action.ts` — `createAction()` wrapper and `formDataToObject()`
- `utils/format.ts` — `formatPrice` (integer minor units), `formatNumber`,
  `formatDate`, `truncate`, with memoised `Intl` formatters
- `utils/slug.ts` — `slugify`, `isValidSlug`
- `hooks/use-media-query.ts`, `hooks/use-debounced-value.ts`
- `types/database.ts` — empty-schema stub with `Tables<>`, `TablesInsert<>`,
  `TablesUpdate<>`, `Enums<>` helpers
- `types/index.ts` — `Paginated`, `PaginationParams`, `PageParams`,
  `PageSearchParams`, `SortDirection`
- Layer contracts documented in `actions/README.md` and `services/README.md`

#### Supabase

- `supabase/client.ts` — browser client, RLS enforced
- `supabase/server.ts` — per-request server client and `getCurrentUser()`, both
  memoised with React `cache()`, RLS enforced
- `supabase/admin.ts` — service-role client, RLS bypassed, guarded by
  `server-only`
- `supabase/session.ts` — Edge session refresh with an anonymous short-circuit
  and protected-route redirect
- `middleware.ts` — session refresh with a matcher excluding Next internals,
  metadata routes and static asset extensions
- Supabase CLI project initialised: `supabase/config.toml`,
  `supabase/migrations/`

#### Pages and layout

- `app/layout.tsx` — root layout with self-hosted Geist fonts, full metadata
  (title template, Open Graph, Twitter, `metadataBase`), theme-colour viewport,
  skip link, header, footer
- `app/page.tsx` — static home page
- `app/not-found.tsx` — 404
- `app/error.tsx` — route error boundary
- `app/global-error.tsx` — root-layout error boundary, inline-styled
- `components/layout/site-header.tsx` — navigation placeholder with landmarks
- `components/layout/site-footer.tsx` — footer placeholder
- `components/layout/container.tsx` — the site's single horizontal rhythm

#### Security

- Security headers on every response: `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security`
- `poweredByHeader: false`
- `next/image` remote host allow-list restricted to Supabase Storage

#### Documentation

- `README.md` — setup, architecture, Supabase guide, conventions, and an
  explanation of every dependency
- `.env.example` — annotated environment template

### Fixed during Phase 1 review

A full architectural review before sign-off. Issues are listed in severity
order.

#### High

- **67 kB of server-only code was shipping in every client bundle.**
  `app/error.tsx` (a Client Component) imported `lib/logger`, which imported
  `lib/env`, which pulled Zod and the entire environment schema into the shared
  chunk for all routes. Broke the chain by having `lib/logger.ts` read
  `process.env.NODE_ENV` directly. Combined with adding `radix-ui` to
  `optimizePackageImports`: **First Load JS 198 kB → 131 kB (−34%)**. Verified
  by grepping the built chunks — no env-validation or service-role strings
  remain client-side.
- **`createAction()` silently swallowed `redirect()` and `notFound()`.** Both
  signal by throwing, so the catch block would have converted a checkout
  redirect into "Something went wrong." Now calls `unstable_rethrow()` before
  inspecting any error.
- **`getCurrentUser()` performed a network round trip per call site.** A layout
  plus five components meant six JWT validations per render. Both it and
  `createClient()` are now memoised per request with React `cache()`.
- **Middleware called Supabase Auth on every request, including anonymous
  ones.** Every crawler hit and logged-out shopper paid a round trip to refresh
  a session that did not exist. Now short-circuits when no `sb-*-auth-token`
  cookie is present; protected routes still redirect.

#### Medium

- **`NEXT_PUBLIC_SITE_URL` was mandatory**, so every Vercel preview deployment
  would have emitted production URLs in canonical tags, Open Graph metadata and
  auth redirects. Now falls back to `NEXT_PUBLIC_VERCEL_URL`, then localhost.
- **`app/global-error.tsx` was missing.** `app/error.tsx` renders inside the
  root layout and cannot catch a failure in the layout that renders it.
- **`radix-ui` barrel imports were not optimised** — `optimizePackageImports`
  covered `lucide-react` but not `radix-ui`.
- **`/admin` appeared protected but was authentication-only.** Every signed-in
  customer cleared the middleware gate. Latent (no admin routes exist), now
  documented at the definition in `lib/routes.ts` and tracked as K-1.
- **`next.config.ts` degraded silently on a missing Supabase URL** — an empty
  `remotePatterns` list builds fine and 404s every product image in production.
  Now throws at build time.

#### Low

- Moved `Result`, `ok()` and `err()` out of `types/` into `lib/result.ts` —
  `types/` must emit no runtime code
- `utils/format.ts` violated its own stated purity rule by importing
  `lib/site-config` → `lib/env` → Zod; `lib/site-config.ts` now has zero imports
- Renamed `supabase/middleware.ts` → `supabase/session.ts` to end the collision
  with the root `middleware.ts`
- Corrected a false claim in `README.md` that no file outside `lib/env.ts` read
  `process.env`
- Removed `suppressHydrationWarning` from `<html>` — no theme provider exists,
  so it only masked real hydration bugs
- `<html lang>` now derives from `siteConfig.locale` instead of being hardcoded,
  and `og:locale` was added
- Removed an empty layout `<div>` from the header
- Middleware matcher now excludes `robots.txt`, `sitemap.xml` and
  `manifest.webmanifest`
- Memoised `Intl` formatters in `utils/format.ts` — catalog pages render
  hundreds of prices

One regression was introduced and caught during the review: the first
`NEXT_PUBLIC_SITE_URL` fix gated its localhost fallback on
`NODE_ENV === "development"`, but `next build` runs with `NODE_ENV=production`
even locally, which made the documented-as-optional variable mandatory. The
build failed; the fallback was ungated and a loud stdout warning added for
production builds that reach it.

### Verified

| Check                         | Result                               |
| ----------------------------- | ------------------------------------ |
| `npm run check`               | passes                               |
| `npm run build`               | passes                               |
| First Load JS                 | 131 kB                               |
| Shared JS                     | 138 kB                               |
| Middleware bundle             | 162 kB                               |
| Static prerendered routes     | 2 (`/`, `/_not-found`)               |
| Security headers at runtime   | present                              |
| `x-powered-by`                | absent                               |
| Anonymous → `/account/orders` | redirects to `/sign-in?redirectTo=…` |
| Fonts                         | resolve to Geist                     |
| Env/Zod in client chunks      | absent                               |

### Known limitations at this version

No database schema, no migrations, no RLS policies, no auth flow, no product
pages, no cart, no checkout, no admin dashboard, no tests, no CI, no
Content-Security-Policy. The catalog routes in `lib/routes.ts` are declared but
not implemented, which is why the home page links nowhere.

Tracked in [PROJECT_STATUS.md](PROJECT_STATUS.md#known-issues).

---

> `v0.1.0` is tagged and pushed to `origin`.

[Unreleased]: https://github.com/urinboeveshonqul-svg/Bondo/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/urinboeveshonqul-svg/Bondo/releases/tag/v0.1.0
