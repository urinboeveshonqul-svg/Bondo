# Changelog

All notable changes to Bondo are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until v1.0.0 the minor version tracks the phase: v0.1.0 is Phase 1, v0.2.0 is
Phase 2, and so on. v1.0.0 is the production launch at the end of Phase 9.

---

## [Unreleased]

### Added

- `docs/database/` — ERD, table relationships, permission graph, storage
  architecture, inventory flow and the product model, as Mermaid diagrams.
  Written from schema introspection rather than from memory, and cross-checked
  against `pg_catalog` so the counts cannot drift from the database.

### Fixed

- **A missing public environment variable failed the build as
  `Failed to collect page data for /_not-found`** — a message that names an
  innocent file and never mentions environment variables. The throw actually
  comes from `lib/env.ts`, imported by `app/layout.tsx` for `metadataBase`;
  `/_not-found` is just the first route whose page data Next collects.
  `next.config.ts` now preflights the whole required public env set before the
  build starts and reports every problem at once, so the failure names the
  variable and says how to set it (ADR-31). The build still fails — it stops
  misattributing the cause.
- **Env validation accepted two values it should have rejected** (ADR-32). Both
  `z.url()` and `URL.canParse()` accept any scheme, so
  `postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres` — the connection
  string Supabase displays beside the project URL — validated and then failed at
  the first query. Now checked with `z.httpUrl()` and an explicit scheme test.
  A value carrying a trailing newline from a paste also passed every truthiness
  and length check, leaving the credential quietly wrong at runtime; it is now
  rejected rather than trimmed, so the mistake is fixed where it was entered.
- The preflight failure now **leads with a status line per variable**, so a
  truncated build log still answers "which one".

---

## [0.2.0] — 2026-08-01

**Phase 2 — Database Foundation.** The database platform every later feature
depends on: 18 tables, a role/permission authorisation model, an append-only
inventory ledger and audit log, 5 storage buckets, RLS on every table, and a
guarded development seed.

No UI, no services, no application code. `app/`, `components/`, `lib/`,
`hooks/`, `utils/` and `actions/` are byte-for-byte unchanged; the only
non-`supabase/` edit is a comment in `types/database.ts`.

> **Scope change.** Phase 2 was planned as "Database & Authorization" and
> included the sign-in/sign-up flow and the first services. The brief for this
> phase excluded all UI, so those moved to Phase 3 and `ROADMAP.md` was updated.
> **K-2 remains open.** `product_variants` was dropped from the schema — see
> D-8.

### Added

#### Schema — 9 migrations, 18 tables

- `20260801000100_extensions_and_conventions.sql` — `pg_trgm` in the
  `extensions` schema; `set_updated_at()`, `set_row_actor()` and
  `is_valid_slug()` shared by every table that needs them
- `20260801000200_identity_and_rbac.sql` — `profiles`, `roles`, `permissions`,
  `role_permissions`, `user_roles`, `admins`; `is_admin()` and
  `has_permission()`; profile creation trigger on `auth.users`; 20 permissions
  and 5 system roles
- `20260801000300_catalog.sql` — `brands`, `categories`, `products`,
  `product_images`, `product_specifications`; `product_status` and
  `product_visibility` enums
- `20260801000400_inventory.sql` — `inventory`, `inventory_movements`,
  `inventory_movement_type` enum
- `20260801000500_content_and_settings.sql` — `settings`, `site_banners`,
  `banner_placement` enum, six baseline settings
- `20260801000600_audit_log.sql` — `audit_logs`
- `20260801000700_wishlists.sql` — `wishlists`, `wishlist_items`
- `20260801000800_storage_buckets.sql` — 5 buckets, 10 object policies
- `20260801000900_grants.sql` — explicit least-privilege GRANTs

#### Product model

SKU, slug, brand, category, status, visibility, featured flag, list/sale/cost
price in integer minor units (ADR-2), weight, three dimensions, warranty, SEO
title and description, keyword array, unlimited images, unlimited grouped
specifications, and a scheduled `published_at`. Stock is **not** a product
column — see ADR-24.

#### Authorisation

Roles hold permissions; users hold roles (ADR-21). Staff status lives in its own
`admins` table rather than a flag on the customer-writable `profiles` row
(ADR-22). Five system roles — `super_admin`, `catalog_manager`,
`inventory_manager`, `support_agent`, `content_editor` — are protected from
rename and deletion by a trigger.

#### Inventory integrity

`inventory.quantity_on_hand` may change **only** through an
`inventory_movements` insert. A guard trigger raises on any other write,
including from Supabase Studio, so "never overwrite inventory silently" is a
mechanism rather than a convention (ADR-24). Movements are append-only and
stamp `quantity_after` themselves, ignoring whatever the client sent. The
ledger takes a row lock so concurrent movements cannot lose an update.

#### Search

A generated `tsvector` weighted A→D across name/SKU, keywords, short
description and description, with `simple` for identifiers and `english` for
prose, plus a GIN index. A separate trigram index on `sku` backs fuzzy admin
lookup, which `tsvector` cannot do.

#### Row Level Security

Enabled on all 18 tables in the migration that creates each. 45 policies on
`public`, 10 on `storage.objects`. Anonymous users read published products,
visible categories and brands, images and specs of published products, public
settings, and live banners (ADR-28). Customers read and update only their own
profile and own their wishlists. Admin access is permission-gated. Every
`SECURITY DEFINER` helper pins `search_path = ''` (ADR-23).

#### Storage

`products`, `brands`, `banners` and `site-assets` are public-read with MIME
allow-lists and size limits; `avatars` is private and scoped to
`avatars/<user-id>/`. Writes are gated on the same permissions as the
corresponding tables.

#### Development seed

`supabase/seed.sql` — 13 categories across 3 levels, 5 brands, 6 products
deliberately varied (draft, hidden, future-scheduled, on-sale), specifications,
opening stock through the ledger, and a development admin. Aborts if the
database already holds products or admins, so it cannot be run against a live
store (ADR-25, refining ADR-20).

### Fixed

Three defects were caught by validation before they shipped. Two would have
failed on production Supabase:

- **A generated column that Postgres rejects.** `array_to_string()` is STABLE,
  not IMMUTABLE, so using it in the `search_vector` generated column fails with
  "generation expression is not immutable". Confirmed against the engine's own
  volatility catalog, not guessed. Replaced with `array_to_tsvector()`, which is
  immutable; `to_tsvector` also needs its explicit two-argument `regconfig`
  form.
- **Missing explicit GRANTs.** The migrations relied on Supabase's default
  privileges. Added `20260801000900_grants.sql` so the privilege model is
  reviewable and the schema is portable (ADR-30).
- **An invalid append-only test.** A `FOR EACH ROW` trigger cannot fire on an
  empty table, so the audit-log immutability check passed vacuously. Corrected;
  the guarantee now holds with rows present.

### Verified

`supabase db reset` could not run — the Phase 2 machine has no Docker, no local
Postgres and no linked project. Every migration and the seed were instead
applied to a real Postgres engine (PGlite, PostgreSQL 18.3) and **116
assertions** run against the result.

| Area          | Verified                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Structure     | 18 tables, RLS on all, ≥1 policy each, all definer functions pin `search_path`                                                 |
| Anonymous RLS | sees 3 of 6 seeded products — draft, hidden and future-scheduled all excluded                                                  |
| Customer RLS  | own profile only; cannot read inventory/admins/audit; cannot self-grant a role                                                 |
| Admin RLS     | all 6 products, inventory, admin register, all settings                                                                        |
| Deactivation  | `is_active = false` drops an admin to anonymous visibility immediately                                                         |
| Inventory     | ledger drives level (12 − 2 = 10); direct writes, zero deltas and negative stock rejected; client `quantity_after` overwritten |
| Append-only   | UPDATE and DELETE rejected on both `inventory_movements` and `audit_logs`                                                      |
| Category tree | 3-level nesting, subtree containment, cycle rejection, descendant path rebuild                                                 |
| Constraints   | 14 invalid writes rejected; soft-deleted SKU/slug reusable                                                                     |
| Search        | full-text and trigram both match                                                                                               |
| Seed guard    | refuses to run against a non-empty database                                                                                    |

The harness is not committed — see D-7. It stubs `auth` and `storage`, so three
gaps remain and are tracked as K-8, K-9 and K-10.

### Known limitations at this version

- **K-3 (blocking)** — `types/database.ts` is stale. `supabase gen types` runs
  its generator in a container and no container runtime was available. Left
  stale rather than hand-written so the gap is a compile error, not a plausible
  wrong answer (ADR-29). **Run `npm run db:types` before Phase 3.**
- **K-8** — storage policies unexercised at runtime.
- **K-9** — the seed's `auth.users` inserts unverified against real GoTrue.
- **K-10** — trigram search depends on Supabase's default `search_path`.
- No `product_variants` (D-8), no `currency` column (D-9),
  `inventory.quantity_reserved` declared but unwritten until Phase 4 (D-10).

### Process

From the previous unreleased section, now shipped with this version:

- Release policy — the nine mandatory steps every completed phase must end with,
  in [CLAUDE.md § 10](CLAUDE.md#10-release-policy), with the Conventional
  Commits format the project uses
- `npm run verify` (`check` + production build), so step 1 of that policy is one
  command rather than a checklist that can be half-run
- `ROADMAP.md § How phases work` now points at the release policy instead of
  restating a partial version of it

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

> `v0.1.0` is tagged and pushed to `origin`. `v0.2.0` is written up here but not
> yet tagged — the release policy tags only when instructed.

[Unreleased]: https://github.com/urinboeveshonqul-svg/Bondo/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/urinboeveshonqul-svg/Bondo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/urinboeveshonqul-svg/Bondo/releases/tag/v0.1.0
