# Project Status

> **This file is the single source of truth for where the project stands.**
> It is updated at the end of every completed task. If this file and the code
> disagree, the code is right and this file is a bug — fix it immediately.

**Last updated:** 2026-08-01
**Version:** v0.1.0 — ✅ **released**
**Phase:** 1 of 9 — Foundation ✅ **Complete**
**Overall progress:** ~8%

### Release status

| Item             | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Current version  | **v0.1.0**                                                   |
| Released         | 2026-08-01                                                   |
| Release commit   | `7caf0ce090c88832c991f2728bf170acb9ac3501`                   |
| Tag object       | `6e9aee54c50c36b92b6f4208489f6dcb4df1aaec` (annotated)       |
| Branch           | `main`                                                       |
| Remote           | `origin` → https://github.com/urinboeveshonqul-svg/Bondo     |
| GitHub sync      | ✅ synchronised — `main` and `v0.1.0` both present on remote |
| Unpushed commits | none                                                         |

A GitHub _Release_ has not been created from the tag. The annotated tag message
is written to serve as its body if one is wanted.

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

**Phase 1 — Foundation.** Complete and reviewed.

Phase 1 built the toolchain, the architectural boundaries and the Supabase
integration layer. It deliberately shipped **no** product features. The
storefront has a home page and a 404, and that is the whole of it.

Phase 1 underwent a full architectural review before sign-off. Fourteen issues
were found and fixed — see [Changelog for this phase](#changelog-for-this-phase).

---

## Overall progress

**~8%**

Nine phases, weighted by expected effort rather than counted equally — Phase 1
is a small phase and checkout is a large one. The number is an estimate and will
be revised as phases land.

```
Phase 1  Foundation                ████████████████████ 100%   ✅ complete
Phase 2  Database & Authorization  ░░░░░░░░░░░░░░░░░░░░   0%   ← next
Phase 3  Storefront Catalog        ░░░░░░░░░░░░░░░░░░░░   0%
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

- Next.js 15.5.22, App Router, React 19.1, Turbopack for dev and build.
- TypeScript 5 with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
- Tailwind CSS 4 via `@tailwindcss/postcss`; design tokens in
  `styles/globals.css`.
- shadcn/ui (`radix-nova` style, `neutral` base) wired to `styles/globals.css`.
- ESLint 9 flat config, `eslint-config-prettier` last in the chain.
- Prettier 3 with `prettier-plugin-tailwindcss` for canonical class ordering.
- `npm run check` = typecheck + lint + format check. CI-ready.
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

| Check                                  | Result                         |
| -------------------------------------- | ------------------------------ |
| `npm run check`                        | passes                         |
| `npm run build`                        | passes                         |
| First Load JS                          | 131 kB (was 198 kB pre-review) |
| Shared JS                              | 138 kB                         |
| Middleware bundle                      | 162 kB                         |
| Static prerendered routes              | 2 (`/`, `/_not-found`)         |
| Security headers present at runtime    | yes, confirmed in browser      |
| `x-powered-by` suppressed              | yes                            |
| Anonymous → `/account/orders` redirect | yes, confirmed in browser      |
| Fonts resolve to Geist                 | yes, confirmed in browser      |
| Env/Zod absent from client chunks      | yes, confirmed by grep         |

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
  migrations/           SQL migrations (empty — Phase 2)

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

🔴 **No schema exists.**

| Item                 | Status                                                |
| -------------------- | ----------------------------------------------------- |
| Tables               | none                                                  |
| Migrations           | none — `supabase/migrations/` is empty                |
| RLS policies         | none                                                  |
| Seed data            | none, and none planned — no fake data in this project |
| Supabase CLI project | initialised (`supabase/config.toml` present)          |
| `types/database.ts`  | hand-written empty-schema stub, **not yet generated** |

`types/database.ts` currently contains the shape the generator produces for an
empty schema. It exists so `createClient<Database>()` is typed from day one. It
is marked generated and must be replaced by real generator output as soon as the
first migration lands:

```bash
npm run db:types
```

**This stub has never been validated against real generator output.** The first
migration in Phase 2 will prove or disprove it.

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

🔴 **Not started.**

Only `routes.admin.index` (`/admin`) is declared. No pages, no layout, no role
model, no admin queries.

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

| Control                           | Status | Notes                                                                   |
| --------------------------------- | ------ | ----------------------------------------------------------------------- |
| `X-Content-Type-Options: nosniff` | ✅     | verified at runtime                                                     |
| `X-Frame-Options: DENY`           | ✅     | verified at runtime                                                     |
| `Referrer-Policy`                 | ✅     | `strict-origin-when-cross-origin`                                       |
| `Permissions-Policy`              | ✅     | camera, mic, geolocation, browsing-topics all denied                    |
| `Strict-Transport-Security`       | ✅     | 2 years, includeSubDomains, preload                                     |
| `x-powered-by` suppressed         | ✅     | verified at runtime                                                     |
| Content-Security-Policy           | ❌     | deferred — needs a per-request nonce in middleware                      |
| Service-role key client-safe      | ✅     | `server-only` import; verified absent from chunks                       |
| Env validated at boot             | ✅     | Zod, fails the build on missing/malformed values                        |
| `next/image` host allow-list      | ✅     | Supabase Storage only; open allow-list would make this a free image CDN |
| Server Action input validation    | ✅     | mandatory via `createAction()`                                          |
| JWT validated, not trusted        | ✅     | `getUser()` everywhere, never `getSession()`                            |
| Row Level Security                | ⬜     | nothing to secure yet — **mandatory in Phase 2**                        |
| Role-based authorisation          | ❌     | see Admin dashboard status                                              |
| Rate limiting                     | ❌     | Phase 9                                                                 |
| Dependency audit in CI            | ❌     | Phase 9                                                                 |

**Standing rule:** every table gets RLS enabled with explicit policies _before_
it holds data. The anon key is public by design and is only safe because RLS is
on. Server-side checks in actions are defence in depth on top of RLS, never a
replacement for it.

---

## Known issues

| #   | Issue                                                                                                              | Severity      | Plan                                  |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------- |
| K-1 | `/admin` is protected by authentication only; any signed-in customer passes middleware. No admin routes exist yet. | High (latent) | Phase 6, before the first admin route |
| K-2 | Middleware redirects to `/sign-in`, which does not exist, so protected routes currently 404 after redirect.        | Low           | Phase 2                               |
| K-3 | `types/database.ts` is a hand-written stub never validated against real generator output.                          | Medium        | Phase 2                               |
| K-4 | No Content-Security-Policy.                                                                                        | Medium        | Phase 4                               |
| K-5 | Middleware bundle is 162 kB (`@supabase/ssr` + `supabase-js`). Signed-in users pay Edge cold-start cost.           | Low           | Monitor                               |
| K-6 | `allowScripts` in `package.json` is npm 11 syntax. A CI runner on npm 10 will not build `sharp`'s native binding.  | Low           | Phase 9                               |
| K-7 | Header placeholder controls are `disabled`, so keyboard users find only the logo interactive in the header.        | Low           | Phase 3                               |

---

## Technical debt

| #   | Item                                                                                                                                            | Interest rate                 | Pay down                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| D-1 | No tests of any kind, and no CI.                                                                                                                | High — grows with every phase | Phase 9, but add tests alongside Phase 2+ work    |
| D-2 | `Paginated` / `PaginationParams` model offset pagination. Deep offsets and exact `COUNT(*)` do not hold at 50k products.                        | Medium                        | Phase 3 — keyset pagination for storefront browse |
| D-3 | Zod re-enters the client bundle in Phase 3 when forms adopt `zodResolver`. Expected, but re-measure then.                                       | Low                           | Phase 3                                           |
| D-4 | `components/ui/separator.tsx`, `skeleton.tsx` and both hooks are currently unimported.                                                          | Very low — zero bytes shipped | Naturally, as features land                       |
| D-5 | No route groups yet. `app/(storefront)`, `(account)`, `(admin)` are planned but empty ones today would be indirection with nothing behind them. | Low                           | Phase 3                                           |
| D-6 | No `robots.ts` or `sitemap.ts`. Correct for a one-page site; required before launch.                                                            | Low                           | Phase 3                                           |

---

## Architectural decisions

Decisions with lasting consequences. **Do not reverse one without recording the
reversal here.**

| ID     | Decision                                                                                                                                              | Rationale                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-1  | One-directional flow: component → service → Supabase.                                                                                                 | A component that queries directly is a query the team cannot find later. This is the constraint the whole structure rests on.               |
| ADR-2  | Money stored as **integer minor units** (cents).                                                                                                      | Floating point does not belong near a price. Enforced by `formatPrice()` taking minor units.                                                |
| ADR-3  | Slugs persisted on the row, never derived on read.                                                                                                    | Deriving a slug on read means renaming a product silently breaks every existing link.                                                       |
| ADR-4  | RLS is the authorisation boundary. Server checks are defence in depth.                                                                                | The anon key is public. Anything not enforced by RLS is not enforced.                                                                       |
| ADR-5  | `getUser()` everywhere; `getSession()` never.                                                                                                         | `getSession()` trusts the cookie as-is and can be spoofed. `getUser()` validates the JWT against the Auth server.                           |
| ADR-6  | Server Components by default; `"use client"` pushed as far down the tree as possible.                                                                 | Client JS is opt-in, not the default. This is what keeps First Load JS near the framework floor.                                            |
| ADR-7  | `lib/env.ts` is the environment contract; only `next.config.ts` and `lib/logger.ts` read `process.env` directly, both documented at the point of use. | Fail fast at boot with a readable message, rather than `undefined` deep inside a request three weeks later.                                 |
| ADR-8  | `lib/logger.ts` must not import `lib/env.ts`.                                                                                                         | It is imported by Client Components. The import chain put Zod and the env schema in the shared client bundle — 67 kB, measured.             |
| ADR-9  | `types/` contains declarations only; runtime helpers live in `lib/`.                                                                                  | Importing from `types/` must be provably free. `ok()`/`err()` moved to `lib/result.ts` for this reason.                                     |
| ADR-10 | `utils/` may not import env, Supabase or React.                                                                                                       | A formatter that drags Zod into the bundle every time a price renders is not a utility.                                                     |
| ADR-11 | Middleware skips Supabase entirely for requests with no `sb-*-auth-token` cookie.                                                                     | Most storefront traffic is anonymous. Calling `getUser()` for them adds a round trip to Auth on every page view and burns auth quota.       |
| ADR-12 | `createClient()` and `getCurrentUser()` memoised with React `cache()`.                                                                                | Per-request, not cross-request. Six components asking for the user cost one JWT validation, not six.                                        |
| ADR-13 | `createAction()` calls `unstable_rethrow()` before handling any error.                                                                                | `redirect()` and `notFound()` signal by throwing. Catching them turns a redirect into "Something went wrong."                               |
| ADR-14 | Middleware does authentication only, never authorisation.                                                                                             | Role checks need a database read. A query on the Edge in front of the whole site is not a trade worth making.                               |
| ADR-15 | No canonical URL in the root layout.                                                                                                                  | A root canonical is inherited by every page that does not override it, telling crawlers the whole catalog duplicates one URL.               |
| ADR-16 | `NEXT_PUBLIC_SITE_URL` optional, falling back to `NEXT_PUBLIC_VERCEL_URL` then localhost.                                                             | Preview deployments get a hostname that cannot be known in advance. Without the fallback every preview emits production URLs.               |
| ADR-17 | `next.config.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` is missing.                                                                                   | An empty `remotePatterns` list builds fine and 404s every product image in production — a failure that reaches customers before developers. |
| ADR-18 | No root `app/loading.tsx`.                                                                                                                            | Both pages are static. A root loading file flashes a fallback on every navigation and buys nothing.                                         |
| ADR-19 | `lib/utils.ts` stays where it is despite the `lib`/`utils` overlap.                                                                                   | `components.json` and every generated shadcn component import `cn` from `@/lib/utils`. Moving it fights the generator forever.              |
| ADR-20 | No fake or seeded data, in any phase.                                                                                                                 | Placeholder data hides empty states, and empty states are where ecommerce UIs actually break.                                               |

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

---

## Next task

**Phase 2, task 1 — design and apply the initial database schema.**

In order:

1. Write the first migration: `products`, `categories`, `product_images`,
   `profiles`, and the enums they need.
2. **Enable RLS on every table in the same migration that creates it.** A table
   must never exist without policies, not even briefly.
3. Write explicit policies: public read for catalog tables, owner-scoped access
   for `profiles`.
4. Run `npm run db:reset`, then `npm run db:types`, and **replace the stub**
   `types/database.ts` with real generator output. Verify the generated shape
   against the stub's helper types (`Tables<>`, `TablesInsert<>`, ...) and fix
   the helpers if they disagree — resolving K-3.
5. Write the first service, `services/products.service.ts`, following the
   contract in `services/README.md`.
6. Update this file and `CHANGELOG.md`.

**Do not** build catalog pages in Phase 2. Schema, RLS, generated types and the
service layer only.

---

## Next phase

**Phase 2 — Database & Authorization.** See [ROADMAP.md](ROADMAP.md#phase-2--database--authorization).

---

## Changelog for this phase

Full detail in [CHANGELOG.md](CHANGELOG.md). Summary of v0.1.0:

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
