# Project Status

> **This file is the single source of truth for where the project stands.**
> It is updated at the end of every completed task. If this file and the code
> disagree, the code is right and this file is a bug — fix it immediately.

**Last updated:** 2026-08-01
**Version:** v0.2.0 (unreleased) — v0.1.0 is the last tag
**Phase:** 2 of 9 — Database Foundation ✅ **Complete** (one blocker: K-3)
**Overall progress:** ~20%

### Release status

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Latest tag       | **v0.1.0** — `7caf0ce`, released 2026-08-01              |
| Working version  | **v0.2.0**, Phase 2 — **not tagged**                     |
| Phase 2 commit   | `c6c3e5b`                                                |
| Branch           | `main`                                                   |
| Remote           | `origin` → https://github.com/urinboeveshonqul-svg/Bondo |
| GitHub sync      | ✅ synchronised                                          |
| Unpushed commits | none                                                     |

v0.2.0 is written up in `CHANGELOG.md` but not tagged: step 6 of the release
policy tags only when instructed. Tagging it before **K-3** is closed would
publish a version whose generated types do not match its schema.

---

## Project overview

Bondo is a production-grade ecommerce storefront selling computers, components
and accessories — laptops, desktops, GPUs, peripherals.

It is built as a single Next.js application backed by Supabase. The storefront
and the admin dashboard share one codebase, one database and one auth system,
separated by route groups and Row Level Security rather than by deployment.

**Design targets** (the numbers the architecture is built to meet, not numbers
it has been tested against):

| Target            | Value                                             |
| ----------------- | ------------------------------------------------- |
| Catalog size      | 50,000+ products                                  |
| Concurrent admins | 10+                                               |
| Traffic profile   | Overwhelmingly anonymous, read-heavy browsing     |
| Rendering         | Server Components by default; client JS is opt-in |

---

## Current phase

**Phase 2 — Database Foundation.** Complete, with one blocker carried forward.

Phase 2 built the database platform every later feature depends on: 18 tables,
a role/permission authorisation model, an append-only inventory ledger and audit
log, 5 storage buckets, RLS on everything, and a guarded development seed. It
deliberately shipped **no** UI — no admin pages, no storefront pages, no
services. The application is byte-for-byte unchanged.

Scope note: the ROADMAP's original Phase 2 also included the sign-in/sign-up
flow and the first services. The Phase 2 brief excluded all UI, so those moved
to Phase 3 and the roadmap was updated to match. **K-2 is therefore still
open** — the middleware redirect still lands on a 404.

The one thing not delivered is generated types (**K-3**), because
`supabase gen types` needs Docker. See
[Current database status](#current-database-status).

---

## Overall progress

**~20%**

Nine phases, weighted by expected effort rather than counted equally — Phase 1
is a small phase and checkout is a large one. The number is an estimate and will
be revised as phases land.

```
Phase 1  Foundation                ████████████████████ 100%   ✅ complete
Phase 2  Database Foundation       ████████████████████ 100%   ✅ complete (K-3 open)
Phase 3  Storefront Catalog        ░░░░░░░░░░░░░░░░░░░░   0%   ← next
Phase 4  Cart & Checkout           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5  Customer Accounts         ░░░░░░░░░░░░░░░░░░░░   0%
Phase 6  Admin Dashboard           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 7  Commerce Features         ░░░░░░░░░░░░░░░░░░░░   0%
Phase 8  Operations                ░░░░░░░░░░░░░░░░░░░░   0%
Phase 9  Production Hardening      ░░░░░░░░░░░░░░░░░░░░   0%
```

See [ROADMAP.md](ROADMAP.md) for what each phase contains.

---

## Completed work

### Tooling and configuration

- Next.js 15.5.22, App Router, React 19.1. **Turbopack for `dev` only** — the
  production build uses webpack (ADR-33).
- TypeScript 5 with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
- Tailwind CSS 4 via `@tailwindcss/postcss`; design tokens in
  `styles/globals.css`.
- shadcn/ui (`radix-nova` style, `neutral` base) wired to `styles/globals.css`.
- ESLint 9 flat config, `eslint-config-prettier` last in the chain.
- Prettier 3 with `prettier-plugin-tailwindcss` for canonical class ordering.
- `npm run check` = typecheck + lint + format check. CI-ready.
- `npm run verify` = `check` + production build. This is step 1 of the release
  policy in [CLAUDE.md § 10](CLAUDE.md#10-release-policy); it gains a test step
  when the first tests land in Phase 4.
- `.gitattributes` pinning `eol=lf` so a clone is byte-identical on every
  platform and `npm run check` passes on a fresh checkout under Windows.

### Architecture

- Layered structure with a one-directional data flow, documented and enforced by
  module boundaries rather than convention alone.
- `lib/env.ts` — Zod-validated environment contract, parsed at module load.
- `lib/routes.ts` — single source of truth for every internal URL.
- `lib/errors.ts` — `AppError` taxonomy with HTTP status mapping.
- `lib/result.ts` — `Result<T>` for trust boundaries.
- `lib/logger.ts` — structured logging, JSON in production.
- `actions/safe-action.ts` — Server Action wrapper: validate, log, return
  `Result`, rethrow Next.js control-flow signals.
- Layer contracts written up in `actions/README.md` and `services/README.md`.

### Supabase integration

- Four clients, each with a documented trust level: browser, server, admin
  (service role), and Edge session refresh.
- `createClient()` and `getCurrentUser()` memoised per request with React
  `cache()`.
- Middleware session refresh with an anonymous short-circuit.
- Supabase CLI project initialised (`supabase/config.toml`, `migrations/`).

### Pages

Home, 404, root layout, route error boundary, root-layout error boundary, plus
header and footer placeholders. Nothing else.

### Verified

| Check                                  | Result                           |
| -------------------------------------- | -------------------------------- |
| `npm run check`                        | passes                           |
| `npm run build`                        | passes                           |
| First Load JS                          | **103 kB** (139 kB on Turbopack) |
| Shared JS                              | 103 kB                           |
| Middleware bundle                      | **109 kB** (162 kB on Turbopack) |
| Static prerendered routes              | 2 (`/`, `/_not-found`)           |
| Security headers present at runtime    | yes, confirmed in browser        |
| `x-powered-by` suppressed              | yes                              |
| Anonymous → `/account/orders` redirect | yes, confirmed in browser        |
| Fonts resolve to Geist                 | yes, confirmed in browser        |
| Env/Zod absent from client chunks      | yes, confirmed by grep           |

---

## Current architecture

### Data flow

```
Server Component / Server Action  →  service  →  Supabase
```

A component never queries the database. A service never imports React. This one
constraint is what keeps the query layer from becoming a search-and-replace
problem as the catalog grows.

### Layer rules

| Layer       | May import                                   | Must never import               |
| ----------- | -------------------------------------------- | ------------------------------- |
| `utils/`    | other `utils/`, `lib/site-config.ts`         | env, Supabase, React, `lib/*`   |
| `types/`    | other `types/`                               | anything emitting runtime code  |
| `lib/`      | `utils/`, `types/`                           | `services/`, `actions/`, `app/` |
| `services/` | `lib/`, `types/`, `utils/`, Supabase clients | React, `actions/`, `app/`       |
| `actions/`  | `services/`, `lib/`, `types/`, `utils/`      | `app/`                          |
| `app/`      | everything                                   | —                               |

The `lib` / `utils` / `types` split is by **dependency weight**:

- `utils/` are leaf modules. Importing one can never pull Zod, Supabase or React
  into a bundle.
- `lib/` is infrastructure that is allowed to have dependencies.
- `types/` emits no runtime code at all, so importing from it costs zero bytes.

### Error handling

- **`AppError`** is thrown inside the server. It carries a `code`, an HTTP
  `status`, a user-safe `message`, and an optional `cause` for logging.
- **`Result<T>`** is returned across the network boundary, so callers are forced
  by the type system to handle failure.
- Anything that is not an `AppError` is a bug: full stack logged, generic
  message returned.
- `redirect()` and `notFound()` throw to signal themselves, so `createAction()`
  calls `unstable_rethrow()` before inspecting any error.

### Error boundaries

| File                   | Catches                                  |
| ---------------------- | ---------------------------------------- |
| `app/error.tsx`        | Errors in any page below the root layout |
| `app/global-error.tsx` | Errors in the root layout itself         |
| `app/not-found.tsx`    | Unmatched URLs and `notFound()`          |

`app/error.tsx` renders inside the root layout and so cannot catch a failure in
the layout that renders it — hence the second boundary, which replaces the whole
document and styles itself inline.

### Loading states

There is deliberately **no** root `app/loading.tsx`. Both current pages are
static; a root loading file would add a Suspense boundary that flashes a
fallback on every navigation and buys nothing. Loading UI belongs on the
segments that actually fetch, using the `Skeleton` primitive.

---

## Folder structure

```
app/                    Routes, layouts, route-level boundaries. Server Components by default.
  layout.tsx            Root layout: fonts, metadata, header, footer, skip link
  page.tsx              Home page (static)
  not-found.tsx         404
  error.tsx             Route error boundary
  global-error.tsx      Root-layout error boundary

components/
  ui/                   shadcn primitives — generated, editable, ours to modify
    button.tsx
    separator.tsx
    skeleton.tsx
  layout/               App shell
    container.tsx       The site's single horizontal rhythm
    site-header.tsx     Navigation placeholder
    site-footer.tsx     Footer placeholder

lib/                    Cross-cutting infrastructure
  env.ts                Zod-validated environment contract
  routes.ts             Every internal URL + protected route prefixes
  errors.ts             AppError taxonomy
  result.ts             Result<T>, ok(), err()
  logger.ts             Structured logger
  site-config.ts        Static site config — zero imports, by design
  utils.ts              cn() — location fixed by components.json

hooks/                  Client-side hooks. Every file starts with "use client".
  use-media-query.ts
  use-debounced-value.ts

types/                  Declarations only — nothing here emits runtime code
  database.ts           GENERATED. Do not hand-edit.
  index.ts              Result-free shared types: Paginated, PageParams, ...

actions/                Server Actions — mutation entry points
  safe-action.ts        createAction() wrapper + formDataToObject()
  README.md             Layer contract

services/               Data access — every Supabase query lives here
  README.md             Layer contract (no service files yet — Phase 2)

utils/                  Pure helpers. No I/O, no React, no env.
  format.ts             formatPrice, formatNumber, formatDate, truncate
  slug.ts               slugify, isValidSlug

supabase/               Supabase clients + the CLI project
  client.ts             Browser client (RLS enforced)
  server.ts             Server client + getCurrentUser() (RLS enforced, cached)
  admin.ts              Service-role client (RLS BYPASSED, server-only)
  session.ts            Edge session refresh + protected-route redirect
  config.toml           Supabase CLI config
  seed.sql              DEVELOPMENT ONLY. Aborts on a non-empty database.
  migrations/
    ..._extensions_and_conventions.sql   pg_trgm, updated_at/actor triggers, slug check
    ..._identity_and_rbac.sql            profiles, roles, permissions, admins, authz helpers
    ..._catalog.sql                      brands, categories, products, images, specs
    ..._inventory.sql                    inventory + append-only movement ledger
    ..._content_and_settings.sql         settings, site_banners
    ..._audit_log.sql                    audit_logs (append-only)
    ..._wishlists.sql                    wishlists, wishlist_items
    ..._storage_buckets.sql              5 buckets + storage.objects policies
    ..._grants.sql                       explicit least-privilege GRANTs

styles/
  globals.css           Tailwind entry + design tokens

public/                 Static assets served from the root path
```

Root files: `README.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `CHANGELOG.md`,
`CLAUDE.md`, `middleware.ts`, `next.config.ts`, `tsconfig.json`,
`eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `components.json`,
`.env.example`, `.gitignore`, `.gitattributes`, `postcss.config.mjs`,
`.vscode/`.

---

## Tech stack

### Runtime dependencies

| Package                    | Version  | Purpose                                                         |
| -------------------------- | -------- | --------------------------------------------------------------- |
| `next`                     | 15.5.22  | Framework — App Router, RSC, Server Actions, image optimisation |
| `react` / `react-dom`      | 19.1.0   | Required peers                                                  |
| `@supabase/supabase-js`    | ^2.111.0 | Postgres, Auth, Storage, Realtime                               |
| `@supabase/ssr`            | ^0.12.4  | Cookie-based auth for SSR — mandatory for RSC                   |
| `server-only`              | ^0.0.1   | Turns a leaked server secret into a build error                 |
| `zod`                      | ^4.4.3   | Runtime validation for env and Server Action input              |
| `clsx` + `tailwind-merge`  | ^2 / ^3  | The `cn()` pair                                                 |
| `class-variance-authority` | ^0.7.1   | Type-safe component variants                                    |
| `radix-ui`                 | ^1.6.7   | Accessible unstyled primitives under shadcn/ui                  |
| `lucide-react`             | ^1.28.0  | Icons                                                           |
| `tw-animate-css`           | ^1.4.0   | Tailwind 4 animation utilities for shadcn/ui                    |

### Development dependencies

| Package                               | Version     | Purpose                                       |
| ------------------------------------- | ----------- | --------------------------------------------- |
| `typescript`                          | ^5          | Type checking                                 |
| `@types/node` / `react` / `react-dom` | ^20/^19/^19 | Type definitions                              |
| `tailwindcss`                         | ^4          | CSS framework                                 |
| `@tailwindcss/postcss`                | ^4          | Tailwind 4 PostCSS plugin                     |
| `eslint`                              | ^9          | Linter (flat config)                          |
| `eslint-config-next`                  | 15.5.22     | React, hooks, a11y, Core Web Vitals rules     |
| `@eslint/eslintrc`                    | ^3          | FlatCompat shim for `eslint-config-next`      |
| `eslint-config-prettier`              | ^10.1.8     | Disables rules that fight Prettier            |
| `prettier`                            | ^3.9.6      | Formatter                                     |
| `prettier-plugin-tailwindcss`         | ^0.8.1      | Canonical Tailwind class ordering             |
| `shadcn`                              | ^4.16.1     | Component generator CLI                       |
| `supabase`                            | ^2.111.0    | Supabase CLI — local stack, migrations, types |

`sharp` and `unrs-resolver` need native install scripts; npm 11 blocks those by
default and both are approved in the `allowScripts` field of `package.json`.

**Environment:** Node >= 20.9.0. Developed on Node 24.18.0, npm 11.16.0.

---

## Current database status

🟢 **Schema complete.** ⚠️ **Types not yet generated (K-3).**

| Item                 | Status                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Tables               | 18, all with RLS enabled and explicit policies                       |
| Migrations           | 9, in `supabase/migrations/`                                         |
| RLS policies         | 45 on `public`, 10 on `storage.objects`                              |
| Indexes              | 58 on `public`                                                       |
| Storage buckets      | 5 (`products`, `brands`, `avatars`, `banners`, `site-assets`)        |
| Seed data            | development only, `supabase/seed.sql`, guarded against non-empty DBs |
| Supabase CLI project | initialised                                                          |
| `types/database.ts`  | 🔴 **STALE** — still the empty-schema stub                           |

### Tables

| Domain    | Tables                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Identity  | `profiles`, `admins`                                                           |
| RBAC      | `roles`, `permissions`, `role_permissions`, `user_roles`                       |
| Catalog   | `brands`, `categories`, `products`, `product_images`, `product_specifications` |
| Inventory | `inventory`, `inventory_movements`                                             |
| Content   | `settings`, `site_banners`                                                     |
| Audit     | `audit_logs`                                                                   |
| Wishlists | `wishlists`, `wishlist_items`                                                  |

### Database documentation

Full reference with Mermaid diagrams in **[docs/database/](docs/database/)** —
ERD, all 34 foreign keys with their cascade rules, the permission graph and RLS
matrix, storage architecture, inventory flow, and the product model. Written
from schema introspection rather than from memory.

| Document                                           | Covers                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [erd.md](docs/database/erd.md)                     | Every table and column; enums; generated columns            |
| [relationships.md](docs/database/relationships.md) | 34 foreign keys, cascade rules, 23 triggers                 |
| [permissions.md](docs/database/permissions.md)     | Role graph and the full 45-policy RLS matrix                |
| [storage.md](docs/database/storage.md)             | 5 buckets, 10 object policies, public/private split         |
| [inventory.md](docs/database/inventory.md)         | Ledger flow and the guard trigger                           |
| [product-model.md](docs/database/product-model.md) | Current single-SKU model + **proposed** variant model (D-8) |

The counts in this section and in
[docs/database/README.md](docs/database/README.md#at-a-glance) must agree. If
they ever disagree, the schema is right and both documents are wrong.

### ⚠️ Generated types are stale — read before writing any query

`types/database.ts` still describes an empty schema. It was **not** regenerated
in Phase 2 because `supabase gen types` runs its generator inside a container,
and the machine Phase 2 was built on has no Docker and no linked project. Every
mode of the command — `--local`, `--linked`, `--db-url` — needs one.

It was left stale rather than hand-written, deliberately. `Tables` is
`Record<never, never>`, so `supabase.from("products")` is a **compile error**:
the gap fails loudly at build time instead of becoming plausible-but-wrong types
that nobody re-checks. Hand-authoring it would also break the project's own rule
that this file is generated output.

**Before any query is written, on a machine with Docker:**

```bash
npm run db:start && npm run db:reset && npm run db:types
```

Tracked as **K-3**, now a blocking prerequisite for Phase 3.

### How the schema was verified without Docker

`supabase db reset` could not run. Instead every migration and the seed were
applied to a real Postgres engine — PGlite (PostgreSQL 18.3, WebAssembly) — and
**116 assertions** were run against the result: structure, RLS behaviour under
`anon` / customer / admin / deactivated-admin, every check constraint, the
inventory ledger, the category tree, search, and the seed guard. All passed.

That harness lives in the session scratchpad and is **not committed** — it is
evidence for Phase 2's claims, not a substitute for `supabase db reset`. It
stubs `auth` and `storage`, so three things remain unverified and are listed
under [Known issues](#known-issues): the seed's `auth.users` / `auth.identities`
inserts, `storage.objects` policy behaviour at runtime, and Supabase's own role
grants. See **D-7** for committing it properly.

---

## Authentication status

🟡 **Plumbing complete, no flow.**

| Item                                   | Status |
| -------------------------------------- | ------ |
| Supabase Auth clients wired            | ✅     |
| Session refresh in middleware          | ✅     |
| Protected-route redirect               | ✅     |
| `getCurrentUser()` with JWT validation | ✅     |
| Sign-in page                           | ❌     |
| Sign-up page                           | ❌     |
| Sign-out action                        | ❌     |
| OAuth callback handler                 | ❌     |
| Password reset                         | ❌     |
| User roles                             | ❌     |

`lib/routes.ts` declares `/sign-in`, `/sign-up`, `/sign-out`,
`/forgot-password` and `/auth/callback`. None of those pages exist yet, so the
middleware redirect currently lands on a 404 — correct behaviour for this phase,
resolved in Phase 2.

---

## Admin dashboard status

🟡 **No UI. Authorisation model complete.**

Phase 2 built the model the dashboard will run on: a `roles` / `permissions` /
`role_permissions` / `user_roles` graph, an `admins` register, and two helper
functions — `public.is_admin()` and `public.has_permission(text)` — that every
policy calls instead of re-deriving the logic inline.

Five system roles ship with the schema and are protected from rename and
deletion by a trigger, because application code branches on their keys:

| Role                | Grants                                                    |
| ------------------- | --------------------------------------------------------- |
| `super_admin`       | all 20 permissions                                        |
| `catalog_manager`   | products, categories, brands; reads inventory             |
| `inventory_manager` | reads products; reads and adjusts inventory               |
| `support_agent`     | read-only across catalog, inventory and customer profiles |
| `content_editor`    | banners and settings                                      |

Adding an administrator is one row in `admins` plus one in `user_roles`, which
is what the 100+ administrator target requires. Verified: deactivating an admin
(`is_active = false`) immediately drops them to anonymous visibility.

No pages, no layout, no admin queries yet — those are Phase 6.

> ⚠️ **`/admin` is in `protectedRoutePrefixes`, but that list is authentication
> only.** Middleware proves a session exists; it does not check roles, because
> that needs a database read and putting a query on the Edge in front of the
> whole site is not a trade worth making. **Every signed-in customer clears the
> middleware gate for `/admin`.** The first task of Phase 6 — and a prerequisite
> for any admin route existing at all — is a role check in the admin layout,
> backed by RLS. This is the single place in the codebase where the route table
> implies more protection than it delivers, and it is called out in
> `lib/routes.ts` at the definition.

---

## Storefront status

🟡 **Shell only.**

| Item             | Status                                           |
| ---------------- | ------------------------------------------------ |
| Root layout      | ✅ fonts, metadata, skip link, header, footer    |
| Home page        | ✅ static, no data, no outbound links            |
| 404 page         | ✅                                               |
| Error boundaries | ✅ route + root-layout                           |
| Header           | 🟡 placeholder — controls are inert and disabled |
| Footer           | 🟡 placeholder — name, tagline, copyright only   |
| Product listing  | ❌                                               |
| Product detail   | ❌                                               |
| Search           | ❌                                               |
| Categories       | ❌                                               |
| Cart             | ❌                                               |
| Checkout         | ❌                                               |

The home page links nowhere on purpose. The catalog routes are declared in
`lib/routes.ts` but their pages do not exist, and a dead link is worse than no
link.

---

## Security status

| Control                           | Status | Notes                                                                        |
| --------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `X-Content-Type-Options: nosniff` | ✅     | verified at runtime                                                          |
| `X-Frame-Options: DENY`           | ✅     | verified at runtime                                                          |
| `Referrer-Policy`                 | ✅     | `strict-origin-when-cross-origin`                                            |
| `Permissions-Policy`              | ✅     | camera, mic, geolocation, browsing-topics all denied                         |
| `Strict-Transport-Security`       | ✅     | 2 years, includeSubDomains, preload                                          |
| `x-powered-by` suppressed         | ✅     | verified at runtime                                                          |
| Content-Security-Policy           | ❌     | deferred — needs a per-request nonce in middleware                           |
| Service-role key client-safe      | ✅     | `server-only` import; verified absent from chunks                            |
| Env validated at boot             | ✅     | Zod, fails the build on missing/malformed values                             |
| `next/image` host allow-list      | ✅     | Supabase Storage only; open allow-list would make this a free image CDN      |
| Server Action input validation    | ✅     | mandatory via `createAction()`                                               |
| JWT validated, not trusted        | ✅     | `getUser()` everywhere, never `getSession()`                                 |
| Row Level Security                | ✅     | enabled on all 18 tables; 45 policies. Verified against anon/customer/admin  |
| Role-based authorisation          | ✅     | permission-gated policies; verified that a customer cannot self-grant a role |
| SECURITY DEFINER search_path      | ✅     | all 7 definer functions pin `search_path = ''` — verified programmatically   |
| Least-privilege GRANTs            | ✅     | `anon` granted SELECT only on the 7 tables with an anonymous read policy     |
| Append-only audit + stock ledger  | ✅     | trigger-enforced for every role, service_role included                       |
| Storage bucket isolation          | 🟡     | policies written; avatars owner-scoped. Runtime behaviour unverified (K-8)   |
| Rate limiting                     | ❌     | Phase 9                                                                      |
| Dependency audit in CI            | ❌     | Phase 9                                                                      |

**Standing rule:** every table gets RLS enabled with explicit policies _before_
it holds data. The anon key is public by design and is only safe because RLS is
on. Server-side checks in actions are defence in depth on top of RLS, never a
replacement for it.

---

## Known issues

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                                                        | Severity                 | Plan                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------- |
| K-1  | `/admin` is protected by authentication only; any signed-in customer passes middleware. No admin routes exist yet.                                                                                                                                                                                                                                                                                           | High (latent)            | Phase 6, before the first admin route                               |
| K-2  | Middleware redirects to `/sign-in`, which does not exist, so protected routes currently 404 after redirect.                                                                                                                                                                                                                                                                                                  | Low                      | Phase 2                                                             |
| K-3  | **`types/database.ts` is stale.** The schema has 18 tables; the file still describes an empty one. `supabase gen types` needs Docker, which the Phase 2 machine lacks. Fails closed — every `from()` is a compile error.                                                                                                                                                                                     | **High (blocking)**      | Run `npm run db:types` on a machine with Docker, **before Phase 3** |
| K-8  | Storage policies parse and are structurally correct, but `storage.objects` RLS was never exercised at runtime — the validation harness stubs the storage schema. Avatar folder-scoping in particular is unproven.                                                                                                                                                                                            | Medium                   | Verify on first real `supabase start`                               |
| K-9  | The seed's `auth.users` / `auth.identities` inserts follow the documented Supabase shape but were never run against real GoTrue. If the column set has drifted, `db:reset` fails on the seed — noisily, and only locally.                                                                                                                                                                                    | Low                      | First real `npm run db:reset`                                       |
| K-10 | Trigram search (`sku % 'text'`) resolves only because Supabase puts `extensions` on the role search_path. A service that schema-qualifies nothing will break if that default changes.                                                                                                                                                                                                                        | Low                      | Phase 3 — schema-qualify or use `extensions.similarity()`           |
| K-12 | The production build is pinned to webpack because Vercel's Edge bundler cannot consume Turbopack's middleware output (ADR-33). Turbopack builds are the direction of travel, so this should be retested on future Next.js releases rather than assumed permanent.                                                                                                                                            | Low                      | Retest each Next minor; revisit in Phase 9                          |
| K-11 | A `/** … */` JSDoc block **inside** the exported `config` object in `middleware.ts` breaks Vercel deploys with `Unhandled type: "ColonToken" :`. `@vercel/static-config` destructures a property's children positionally and JSDoc adds one. Fixed, and the constraint is documented at the site — but nothing mechanically prevents reintroducing it, and the error names neither the file nor the comment. | Low (fixed, can regress) | Would need a lint rule; revisit in Phase 9 with CI                  |
| K-4  | No Content-Security-Policy.                                                                                                                                                                                                                                                                                                                                                                                  | Medium                   | Phase 4                                                             |
| K-5  | Middleware bundle is 162 kB (`@supabase/ssr` + `supabase-js`). Signed-in users pay Edge cold-start cost.                                                                                                                                                                                                                                                                                                     | Low                      | Monitor                                                             |
| K-6  | `allowScripts` in `package.json` is npm 11 syntax. A CI runner on npm 10 will not build `sharp`'s native binding.                                                                                                                                                                                                                                                                                            | Low                      | Phase 9                                                             |
| K-7  | Header placeholder controls are `disabled`, so keyboard users find only the logo interactive in the header.                                                                                                                                                                                                                                                                                                  | Low                      | Phase 3                                                             |

---

## Technical debt

| #    | Item                                                                                                                                                                                                                                                 | Interest rate                                      | Pay down                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| D-1  | No tests of any kind, and no CI.                                                                                                                                                                                                                     | High — grows with every phase                      | Phase 9, but add tests alongside Phase 2+ work                          |
| D-2  | `Paginated` / `PaginationParams` model offset pagination. Deep offsets and exact `COUNT(*)` do not hold at 50k products.                                                                                                                             | Medium                                             | Phase 3 — keyset pagination for storefront browse                       |
| D-3  | Zod re-enters the client bundle in Phase 3 when forms adopt `zodResolver`. Expected, but re-measure then.                                                                                                                                            | Low                                                | Phase 3                                                                 |
| D-4  | `components/ui/separator.tsx`, `skeleton.tsx` and both hooks are currently unimported.                                                                                                                                                               | Very low — zero bytes shipped                      | Naturally, as features land                                             |
| D-5  | No route groups yet. `app/(storefront)`, `(account)`, `(admin)` are planned but empty ones today would be indirection with nothing behind them.                                                                                                      | Low                                                | Phase 3                                                                 |
| D-6  | No `robots.ts` or `sitemap.ts`. Correct for a one-page site; required before launch.                                                                                                                                                                 | Low                                                | Phase 3                                                                 |
| D-7  | Migration verification lives in a scratchpad PGlite harness that is not committed, so nobody can reproduce Phase 2's 116 assertions. Committing it means a devDependency and a harness that stubs `auth`/`storage` and can drift from real Supabase. | Medium — grows as the schema does                  | Decide when Docker is available; natural home is the Phase 9 test suite |
| D-8  | No `product_variants` table. A single product carries one SKU, price and stock, so a laptop sold in 16GB and 32GB configurations needs two product rows. That is workable for a launch catalog and painful at scale.                                 | Medium — expensive after orders reference products | Before the catalog grows past a few thousand SKUs; revisit in Phase 3   |
| D-9  | No `currency` column. Prices are integer minor units of one store-wide currency (`settings.store.currency`). Multi-currency is explicitly out of scope, but adding the column after orders exist means backfilling history.                          | Low — while out of scope                           | Only if multi-currency is ever adopted                                  |
| D-10 | `inventory.quantity_reserved` is declared but nothing writes it. Phase 4 needs it for oversell prevention; until then `quantity_on_hand` alone describes availability.                                                                               | Low                                                | Phase 4                                                                 |

---

## Architectural decisions

Decisions with lasting consequences. **Do not reverse one without recording the
reversal here.**

| ID     | Decision                                                                                                                                                                                                                           | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-1  | One-directional flow: component → service → Supabase.                                                                                                                                                                              | A component that queries directly is a query the team cannot find later. This is the constraint the whole structure rests on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-2  | Money stored as **integer minor units** (cents).                                                                                                                                                                                   | Floating point does not belong near a price. Enforced by `formatPrice()` taking minor units.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ADR-3  | Slugs persisted on the row, never derived on read.                                                                                                                                                                                 | Deriving a slug on read means renaming a product silently breaks every existing link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-4  | RLS is the authorisation boundary. Server checks are defence in depth.                                                                                                                                                             | The anon key is public. Anything not enforced by RLS is not enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-5  | `getUser()` everywhere; `getSession()` never.                                                                                                                                                                                      | `getSession()` trusts the cookie as-is and can be spoofed. `getUser()` validates the JWT against the Auth server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-6  | Server Components by default; `"use client"` pushed as far down the tree as possible.                                                                                                                                              | Client JS is opt-in, not the default. This is what keeps First Load JS near the framework floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-7  | `lib/env.ts` is the environment contract; only `next.config.ts` and `lib/logger.ts` read `process.env` directly, both documented at the point of use.                                                                              | Fail fast at boot with a readable message, rather than `undefined` deep inside a request three weeks later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-8  | `lib/logger.ts` must not import `lib/env.ts`.                                                                                                                                                                                      | It is imported by Client Components. The import chain put Zod and the env schema in the shared client bundle — 67 kB, measured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-9  | `types/` contains declarations only; runtime helpers live in `lib/`.                                                                                                                                                               | Importing from `types/` must be provably free. `ok()`/`err()` moved to `lib/result.ts` for this reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-10 | `utils/` may not import env, Supabase or React.                                                                                                                                                                                    | A formatter that drags Zod into the bundle every time a price renders is not a utility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-11 | Middleware skips Supabase entirely for requests with no `sb-*-auth-token` cookie.                                                                                                                                                  | Most storefront traffic is anonymous. Calling `getUser()` for them adds a round trip to Auth on every page view and burns auth quota.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-12 | `createClient()` and `getCurrentUser()` memoised with React `cache()`.                                                                                                                                                             | Per-request, not cross-request. Six components asking for the user cost one JWT validation, not six.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-13 | `createAction()` calls `unstable_rethrow()` before handling any error.                                                                                                                                                             | `redirect()` and `notFound()` signal by throwing. Catching them turns a redirect into "Something went wrong."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-14 | Middleware does authentication only, never authorisation.                                                                                                                                                                          | Role checks need a database read. A query on the Edge in front of the whole site is not a trade worth making.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-15 | No canonical URL in the root layout.                                                                                                                                                                                               | A root canonical is inherited by every page that does not override it, telling crawlers the whole catalog duplicates one URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-16 | `NEXT_PUBLIC_SITE_URL` optional, falling back to `NEXT_PUBLIC_VERCEL_URL` then localhost.                                                                                                                                          | Preview deployments get a hostname that cannot be known in advance. Without the fallback every preview emits production URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-17 | `next.config.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` is missing.                                                                                                                                                                | An empty `remotePatterns` list builds fine and 404s every product image in production — a failure that reaches customers before developers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-18 | No root `app/loading.tsx`.                                                                                                                                                                                                         | Both pages are static. A root loading file flashes a fallback on every navigation and buys nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-19 | `lib/utils.ts` stays where it is despite the `lib`/`utils` overlap.                                                                                                                                                                | `components.json` and every generated shadcn component import `cn` from `@/lib/utils`. Moving it fights the generator forever.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-20 | No fake or seeded data, in any phase. **Refined by ADR-25.**                                                                                                                                                                       | Placeholder data hides empty states, and empty states are where ecommerce UIs actually break.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-21 | Permissions are never held by a user directly. Users hold roles; roles hold permissions.                                                                                                                                           | At 100+ administrators, per-user grants become impossible to audit. Revoking a capability from everyone must be one DELETE, not a migration over users.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-22 | Staff status lives in its own `admins` table, not an `is_admin` column on `profiles`.                                                                                                                                              | `profiles` is the one table customers may UPDATE. A privilege flag on it is one mis-scoped policy away from self-service privilege escalation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-23 | Every RLS helper is `SECURITY DEFINER` with `set search_path = ''` and fully schema-qualified references.                                                                                                                          | DEFINER is required — a policy on `user_roles` that queries `user_roles` recurses forever. The pinned search_path stops a caller shadowing `public.admins` with their own table and having it read with elevated rights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ADR-24 | Stock lives only in `inventory`. `products` has no stock column, and `inventory.quantity_on_hand` may change only through an `inventory_movements` insert — enforced by a trigger that rejects every other write.                  | Two writable copies of a quantity are two quantities. The guard makes "never overwrite inventory silently" a mechanism rather than a policy: a Studio edit raises an exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-25 | **Refines ADR-20.** Development-only seed data is permitted in `supabase/seed.sql`, which runs on local `db reset` only and aborts if the database already holds products or admins.                                               | ADR-20's reasoning was about content the storefront ships — placeholder products hiding empty states. A local fixture never reaches a user, and Phase 2 has no UI for it to hide. The abort guard is what keeps the distinction real rather than intended.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-26 | Category nesting stores a trigger-maintained `path uuid[]` alongside `parent_id`, with a GIN index.                                                                                                                                | `parent_id` alone needs a recursive CTE per page view. The path pays that cost once per write, and writes are rare. Cycles are rejected at the trigger, because a cycle in a category tree is an infinite loop in every breadcrumb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-27 | `audit_logs` and `inventory_movements` are append-only, enforced by a trigger rather than by the absence of an RLS policy.                                                                                                         | RLS does not constrain `service_role`. An audit log that anyone holding the service key can rewrite is not evidence of anything.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-28 | Anonymous read extends to visible categories, brands, published-product images/specs, public settings and live banners — not products alone.                                                                                       | A product page must name its brand and the nav must list categories. Restricting these to `service_role` would move the whole storefront off RLS, which is the opposite of the intent. Recorded because the Phase 2 brief said "read published products only".                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-29 | `types/database.ts` was left stale rather than hand-written when the generator could not run.                                                                                                                                      | An empty `Tables` makes every `from()` a compile error, so the gap fails loudly. Fabricated types would be plausible, wrong, and unchecked — and would break the rule that this file is generated output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-30 | GRANTs are written out explicitly instead of relying on Supabase's default privileges.                                                                                                                                             | A privilege model that exists only as a platform default is one nobody can review. `anon` gets SELECT on exactly the seven tables with an anonymous read policy, so a mistaken policy still meets a closed second gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-33 | The production build uses **webpack**; `--turbopack` is kept on `dev` only.                                                                                                                                                        | Vercel's Edge bundler expects `.next/server/middleware.js`. Turbopack emits no such file — it emits three chunks, one named `[root-of-the-server]__….js`, and Vercel then fails with `The Edge Function "middleware" is referencing unsupported modules: @/supabase/session`. Webpack also measured smaller here: First Load JS 139 kB → 103 kB, middleware 162 kB → 109 kB. `dev` keeps Turbopack, where the speed matters and nothing is deployed. Revisit per **K-12**.                                                                                                                                                                                                                               |
| ADR-32 | Env URLs are validated with `z.url({ protocol: /^https?$/ })` — scheme restricted, host **not** — plus an explicit scheme check in the preflight; and a value with leading or trailing whitespace is rejected rather than trimmed. | Plain `z.url()` and `URL.canParse()` accept `postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres`, the connection string Supabase shows beside the project URL; it would validate and then fail at the first query. `z.httpUrl()` fixes that but also demands a public-looking domain, rejecting `http://localhost:3000` and `http://127.0.0.1:54321` — the local Supabase URL `.env.example` prescribes. Restricting the scheme was the requirement; restricting the host broke local development. Whitespace from a paste survives every truthiness and length check, making a credential quietly wrong at runtime; trimming silently would hide the mistake from whoever can fix it at source. |
| ADR-31 | **Extends ADR-17.** `next.config.ts` preflights the whole required public env set, not only `NEXT_PUBLIC_SUPABASE_URL`, and reports every problem at once.                                                                         | A missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` was not caught until page-data collection, where `lib/env.ts` throws while importing the root layout. Next surfaces that as `Failed to collect page data for /_not-found` — naming an innocent file and never mentioning environment variables. The preflight fails just as hard, one stage earlier, naming the variable.                                                                                                                                                                                                                                                                                                                                      |

---

## Environment variables

Declared, parsed and typed in `lib/env.ts`. Copy `.env.example` to `.env.local`.

| Variable                        | Scope  | Required | Notes                                                       |
| ------------------------------- | ------ | -------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client | **yes**  | Project REST URL. Also allow-lists the image host at build. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | **yes**  | Public by design; constrained by RLS.                       |
| `NEXT_PUBLIC_SITE_URL`          | client | no       | Falls back to `NEXT_PUBLIC_VERCEL_URL`, then localhost.     |
| `SUPABASE_SERVICE_ROLE_KEY`     | server | no       | **Bypasses RLS.** Admin/webhook/job use only.               |

`NEXT_PUBLIC_*` values are inlined into the client bundle. Never put a secret
behind that prefix.

A production build that resolves the site URL to localhost warns loudly on
stdout rather than failing, because `next build` runs with `NODE_ENV=production`
even on a laptop.

### These are build-time requirements, not just runtime

`app/layout.tsx` imports `lib/env.ts` for `metadataBase`, and every route is
rendered inside that layout. A missing or malformed public variable therefore
**fails the build**, not the first request. That is intended (ADR-7), but it
used to surface unhelpfully:

```
Error: Invalid public environment variables:
  → at NEXT_PUBLIC_SUPABASE_ANON_KEY
> Build error occurred
[Error: Failed to collect page data for /_not-found]
```

The last line is the one people read, and it points at `app/not-found.tsx`,
which is innocent — the throw comes from the shared root layout, and
`/_not-found` is simply the first route whose page data Next collects.

`next.config.ts` now preflights the same variables before the build starts
(ADR-31), so this presents as a config error naming the variable. **On Vercel,
set these under Project → Settings → Environment Variables for every
environment you deploy** (Production, Preview, Development) — a variable set for
Production only will still fail preview builds.

---

## Next task

**Close K-3 — generate the database types.** This is a prerequisite for
everything in Phase 3; no query can be written until it is done.

On a machine with Docker Desktop installed and running:

```bash
npm run db:start     # boots the local Supabase stack
npm run db:reset     # replays all 9 migrations, then runs seed.sql
npm run db:types     # overwrites types/database.ts with generator output
npm run verify       # typecheck + lint + format + build
```

Then check three things the offline harness could not:

1. `db:reset` completes — in particular the seed's `auth.users` and
   `auth.identities` inserts (**K-9**).
2. Sign in locally as `admin@bondo.local` / `bondo-dev-password`, and confirm an
   avatar upload lands under `avatars/<user-id>/` and is not readable by a
   second account (**K-8**).
3. The regenerated `types/database.ts` agrees with the `Tables<>` /
   `TablesInsert<>` / `TablesUpdate<>` / `Enums<>` helpers in the same file —
   fix the helpers if the generator's shape differs.

Commit the regenerated types. After that, Phase 3 may begin.

---

## Next phase

**Phase 3 — Storefront Catalog.** See [ROADMAP.md](ROADMAP.md#phase-3--storefront-catalog).
It now also carries the auth flow and the first services, which moved out of
Phase 2 when that phase was scoped to the database only.

---

## Changelog for this phase

Full detail in [CHANGELOG.md](CHANGELOG.md). Summary of v0.2.0:

**Added** — 9 migrations defining 18 tables with RLS on every one (45 policies,
plus 10 on `storage.objects`); a roles/permissions authorisation model with 20
permissions and 5 protected system roles; an append-only inventory ledger whose
guard trigger rejects any other write to `quantity_on_hand`; an append-only
audit log immutable even to `service_role`; a category tree of unlimited depth
with cycle rejection; a weighted full-text search vector plus trigram SKU
lookup; 58 indexes, each carrying its justification; 5 storage buckets; explicit
least-privilege GRANTs; and a development seed that aborts on a non-empty
database.

**Verified** — 116 assertions against a real Postgres engine. Three bugs were
caught and fixed during that process, two of which would have failed on
production Supabase: a non-immutable generated column, an invalid append-only
test, and missing explicit grants.

**Not delivered** — generated types (**K-3**), because `supabase gen types`
requires Docker. The stub was left stale on purpose so the gap is a compile
error rather than a silent wrong answer.

---

Summary of v0.1.0:

**Added** — Next.js 15 App Router foundation; TypeScript strict config; Tailwind
4 + shadcn/ui; ESLint + Prettier; the full layer structure with written
contracts; `lib/env.ts`, `routes.ts`, `errors.ts`, `result.ts`, `logger.ts`,
`site-config.ts`; four Supabase clients; middleware session refresh; home page,
404, root layout, two error boundaries; header and footer placeholders;
security headers; README, `.env.example`, `.vscode/` settings.

**Reviewed and fixed** — a full architectural review before sign-off found and
fixed 14 issues. The four that mattered most:

1. **67 kB of server-only code was shipping to every client.** `app/error.tsx` →
   `lib/logger` → `lib/env` pulled Zod and the env schema into the shared chunk.
   **First Load JS 198 kB → 131 kB (−34%).**
2. **`createAction()` swallowed `redirect()` and `notFound()`**, which would have
   silently broken Phase 4 checkout.
3. **`getCurrentUser()` did a network round trip per call site** — now memoised
   per request.
4. **Middleware called Supabase Auth on every anonymous request** — now
   short-circuits when no auth cookie is present.

Also fixed: Vercel preview URLs, missing `global-error.tsx`, unoptimised
`radix-ui` barrel imports, silent image-host misconfiguration, runtime code in
`types/`, `utils/format.ts` breaking its own purity rule, duplicate
`middleware.ts` filenames, a false claim in the README, and four smaller items.

One bug was introduced and caught during that review: the first
`NEXT_PUBLIC_SITE_URL` fix gated its fallback on `NODE_ENV === "development"`,
which made the "optional" variable mandatory for local production builds. The
build failed, and the fallback was ungated with a loud warning instead.
