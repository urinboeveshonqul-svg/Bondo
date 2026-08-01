# Bondo

A computer store — laptops, desktops, components and accessories.

**Status: Phase 1 (foundation), v0.1.0.** The toolchain, architecture and
Supabase integration layer are in place. The only pages that exist are the home
page and the 404. There is no schema, no product data and no checkout yet.

### Project documentation

This README explains **how the codebase works**. Four companion documents cover
**where the project is** and **how to work on it**, and they take precedence
over this file for anything about state:

| Document                               | Answers                                               |
| -------------------------------------- | ----------------------------------------------------- |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | What exists right now, what is broken, what is next   |
| [ROADMAP.md](ROADMAP.md)               | Every phase, what each contains, how far along we are |
| [CHANGELOG.md](CHANGELOG.md)           | What changed, in which version                        |
| [CLAUDE.md](CLAUDE.md)                 | Standing rules for AI-assisted work in this repo      |

---

## Stack

| Concern    | Choice                                    |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 15 (App Router, React 19, RSC)    |
| Language   | TypeScript 5 (strict)                     |
| Styling    | Tailwind CSS 4                            |
| Components | shadcn/ui (Radix primitives)              |
| Backend    | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Quality    | ESLint 9 (flat config) + Prettier 3       |

---

## Getting started

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see [Environment](#environment). The app will not boot
with missing variables, by design.

```bash
npm run dev
```

Open http://localhost:3000.

### Scripts

| Script                      | What it does                                           |
| --------------------------- | ------------------------------------------------------ |
| `npm run dev`               | Dev server with Turbopack                              |
| `npm run build`             | Production build                                       |
| `npm start`                 | Serve the production build                             |
| `npm run lint`              | ESLint                                                 |
| `npm run lint:fix`          | ESLint with autofix                                    |
| `npm run typecheck`         | `tsc --noEmit`                                         |
| `npm run format`            | Prettier write                                         |
| `npm run format:check`      | Prettier check (use in CI)                             |
| `npm run check`             | typecheck + lint + format check                        |
| `npm run verify`            | `check` + production build — required before a release |
| `npm run db:start`          | Start the local Supabase stack (needs Docker)          |
| `npm run db:stop`           | Stop it                                                |
| `npm run db:reset`          | Drop and replay all migrations locally                 |
| `npm run db:diff -- <name>` | Write a migration from local schema changes            |
| `npm run db:push`           | Apply pending migrations to the linked project         |
| `npm run db:types`          | Regenerate `types/database.ts` from the local DB       |
| `npm run db:types:remote`   | Regenerate it from the linked hosted project           |

Run `npm run check` before every commit, and `npm run verify` before closing out
a phase. The full phase-completion checklist is
[CLAUDE.md § 10 — Release policy](CLAUDE.md#10-release-policy).

---

## Environment

All variables are declared, parsed and typed in [`lib/env.ts`](lib/env.ts).
Parsing happens at module load, so a missing or malformed value fails the build
with a readable message instead of surfacing as `undefined` inside a request
three weeks later.

| Variable                        | Scope  | Required | Notes                                      |
| ------------------------------- | ------ | -------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | client | yes      | Project REST URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | yes      | Constrained by RLS; safe to expose         |
| `NEXT_PUBLIC_SITE_URL`          | client | no       | Falls back to `VERCEL_URL`, then localhost |
| `SUPABASE_SERVICE_ROLE_KEY`     | server | no       | **Bypasses RLS.** Admin/webhook use only   |

`NEXT_PUBLIC_*` values are inlined into the client bundle — never put a secret
behind that prefix.

Exactly two modules read `process.env` outside `lib/env.ts`, both deliberately
and both documented at the point of use:

- [`next.config.ts`](next.config.ts) — evaluated before any application module,
  so it cannot import one.
- [`lib/logger.ts`](lib/logger.ts) — imported by Client Components, so importing
  the env module would pull Zod and the environment schema into the shared
  client bundle for every route.

### Site URL and preview deployments

`NEXT_PUBLIC_SITE_URL` is optional because Vercel preview deployments get a
generated hostname that cannot be known in advance. Resolution order is explicit
setting → `https://$NEXT_PUBLIC_VERCEL_URL` → `http://localhost:3000`. Set it
explicitly on production so the custom domain wins; leave it unset on previews,
or every preview will emit production URLs in its canonical tags and auth
redirects.

---

## Architecture

```
app/          Routes, layouts, and route-level boundaries. Server Components by default.
components/   ui/ = shadcn primitives (generated, editable). layout/ = app shell.
lib/          Cross-cutting infrastructure: env, routes, errors, result, logger, cn().
hooks/        Client-side React hooks. Every file starts with "use client".
types/        Type declarations only — nothing here emits runtime code.
actions/      Server Actions — mutation entry points called from the UI.
services/     Data access. Every Supabase query lives here.
utils/        Pure helpers. No I/O, no React, no env, no framework imports.
supabase/     Supabase clients + the CLI project (config.toml, migrations/).
styles/       globals.css — Tailwind entry and the design tokens.
public/       Static assets served from the root path.
```

### `lib/` vs `utils/` vs `types/`

Three folders that could all be called "shared code", so the split is by
dependency weight, and it is enforced by review:

- **`utils/`** — leaf modules. Pure functions with no I/O and no framework
  imports. Importing one can never pull Zod, Supabase or React into a bundle.
  `utils/format.ts` may import `lib/site-config.ts` only because that file is an
  object literal with no imports of its own.
- **`lib/`** — infrastructure that is allowed to have dependencies: env parsing,
  the logger, the error taxonomy, the route table. `lib/utils.ts` holds `cn()`
  and stays where it is because `components.json` and every generated shadcn
  component import it from `@/lib/utils`.
- **`types/`** — declarations only. Everything here compiles away, so importing
  from it costs zero bytes. Runtime helpers that were once here (`ok`, `err`)
  live in `lib/result.ts` for exactly that reason.

### The one rule that keeps this scalable

Data flows in one direction:

```
Server Component / Server Action  →  service  →  Supabase
```

A component never queries the database, and a service never imports React. That
single constraint is what lets the catalog grow to hundreds of files without the
query layer turning into a search-and-replace problem. Each layer has a README
or a doc comment stating its contract:

- [`actions/README.md`](actions/README.md) — validate, authorise, delegate,
  revalidate, return a `Result`.
- [`services/README.md`](services/README.md) — one file per aggregate, takes a
  Supabase client, throws `AppError`.

### Errors and results

Two complementary mechanisms, deliberately:

- **`Result<T>`** ([`lib/result.ts`](lib/result.ts)) is returned across the
  network boundary — Server Actions and Route Handlers — so the caller is forced
  by the type system to handle failure.
- **`AppError`** ([`lib/errors.ts`](lib/errors.ts)) is thrown inside the server.
  Services throw it; `createAction()` catches it and converts it to a `Result`.

Anything that is not an `AppError` is a bug: it is logged with a full stack and
flattened to a generic message so internal detail never reaches the client.

One exception is handled explicitly: `redirect()` and `notFound()` signal
themselves by throwing, so `createAction()` calls `unstable_rethrow` before it
inspects anything. Without that, a `redirect()` inside an action would be
swallowed and silently turn into an error message.

### Error boundaries

| File                                           | Catches                                  |
| ---------------------------------------------- | ---------------------------------------- |
| [`app/error.tsx`](app/error.tsx)               | Errors in any page below the root layout |
| [`app/global-error.tsx`](app/global-error.tsx) | Errors in the root layout itself         |
| [`app/not-found.tsx`](app/not-found.tsx)       | Unmatched URLs and `notFound()`          |

`app/error.tsx` renders _inside_ the root layout, so it cannot catch a failure
in the layout that renders it — hence the second boundary, which replaces the
whole document and styles itself inline so a broken stylesheet cannot take it
down too.

### Loading states

There is deliberately no root `app/loading.tsx`. Both current pages are static,
so a root loading file would add a Suspense boundary that renders a flash of
fallback on every navigation while buying nothing. Loading UI belongs on the
segments that actually fetch — the catalog and account routes — using the
`Skeleton` primitive.

### Routing

Every internal URL lives in [`lib/routes.ts`](lib/routes.ts). Components import
from it rather than hard-coding strings, so a path change is one edit and
TypeScript finds every call site. Routes for the full storefront are already
declared; their pages arrive in later phases.

`protectedRoutePrefixes` in the same file drives the auth redirect in
middleware, which keeps the route table and the auth policy from drifting apart.

That list is **authentication only**. Middleware proves a valid session exists;
it does not check roles, because that needs a database read and putting a query
on the Edge in front of the whole site is not a trade worth making. `/admin`
consequently needs a second role check in its own layout — every signed-in
customer clears the middleware gate. The real boundary for admin data is RLS
plus that layout check.

Route groups (`app/(storefront)`, `app/(account)`, `app/(admin)`) are introduced
in Phase 3, when the segments actually need different layouts. Adding empty ones
now would be indirection with nothing behind it.

---

## Supabase

### Which client to use

| File                                         | Runs in                              | RLS          |
| -------------------------------------------- | ------------------------------------ | ------------ |
| [`supabase/client.ts`](supabase/client.ts)   | Client Components                    | enforced     |
| [`supabase/server.ts`](supabase/server.ts)   | Server Components, Actions, Handlers | enforced     |
| [`supabase/admin.ts`](supabase/admin.ts)     | Trusted server code only             | **bypassed** |
| [`supabase/session.ts`](supabase/session.ts) | Edge middleware                      | enforced     |

The server client is created **per request** — it reads the session from
cookies, so hoisting it into a module singleton would leak one user's session
into another user's request.

Both `createClient()` and `getCurrentUser()` are wrapped in React's `cache()`.
That is per-request memoisation, not a cross-request cache: a page where a
layout and five components each call `getCurrentUser()` performs one JWT
validation instead of six. Without it, every additional component that needs the
user adds a network round trip to Supabase Auth.

Use `getCurrentUser()` rather than reading the session directly. It calls
`supabase.auth.getUser()`, which validates the JWT against the Auth server;
`getSession()` trusts the cookie as-is and can be spoofed.

### Why middleware exists

Supabase access tokens are short-lived, and Server Components cannot write
cookies. [`middleware.ts`](middleware.ts) refreshes the session on matched
requests and writes the rotated cookies onto the response. Without it users are
silently logged out mid-session. It also redirects unauthenticated users away
from protected prefixes.

**Anonymous requests skip the Supabase call entirely.** If no `sb-*-auth-token`
cookie is present there is no session to refresh, so middleware returns
immediately. On a storefront that covers every crawler and every logged-out
shopper — the large majority of traffic — and removes a round trip to Supabase
Auth from the critical path of each of those page views. That round trip is both
the dominant latency cost in middleware and a per-request charge against the
project's auth quota.

The matcher excludes `_next/static`, `_next/image`, metadata routes and static
asset extensions. It is a negative lookahead rather than a list of positive
matches on purpose: over-matching wastes microseconds, under-matching means a
page never refreshes its token and users are logged out at random.

### Security posture

Row Level Security is the authorisation boundary, not an optimisation. When the
schema lands in Phase 2, **every** table gets RLS enabled with explicit policies
before it holds data. The anon key is public by design; it is only safe because
RLS is on.

Server-side checks in actions are defence in depth on top of RLS, not a
replacement for it.

### Local development

Requires Docker.

```bash
npm run db:start
```

The CLI prints the local API URL and anon key — put those in `.env.local`. Then:

```bash
npm run db:reset
```

After any schema change, regenerate the types and commit them:

```bash
npm run db:types
```

`types/database.ts` is generated output. Do not hand-edit it. Today it holds the
empty-schema shape, which is what the generator produces before the first
migration — it exists so `createClient<Database>()` is typed from day one.

---

## Conventions

- **Server Components by default.** Add `"use client"` only for interactivity,
  and push it as far down the tree as possible.
- **Money is stored as integer minor units** (cents). Floating point does not
  belong anywhere near a price. Format with `formatPrice()` from
  [`utils/format.ts`](utils/format.ts).
- **Slugs are persisted, not derived.** Deriving a slug on read means renaming a
  product silently breaks every existing link.
- **Files are `kebab-case.ts`**, components are `PascalCase`, hooks are
  `use-thing.ts` exporting `useThing`.
- **Imports use the `@/` alias.** No `../../..`.
- **Log through [`lib/logger.ts`](lib/logger.ts)**, not `console` — ESLint
  enforces it. Output is JSON in production so a log drain can parse it.

TypeScript runs with `strict` plus `noUncheckedIndexedAccess`, which makes
`array[i]` possibly-`undefined`. It is occasionally noisy and it is the single
most effective compiler flag for preventing runtime `undefined` crashes.

---

## Dependencies

Everything installed and why. Nothing here is speculative.

### Runtime

| Package                    | Why                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `next`                     | The framework. App Router, RSC, Server Actions, image optimisation, routing.                                           |
| `react`, `react-dom`       | Required peers of Next.js.                                                                                             |
| `@supabase/supabase-js`    | Core Supabase SDK — Postgres queries, Auth, Storage, Realtime.                                                         |
| `@supabase/ssr`            | Cookie-based auth for SSR. The plain SDK assumes `localStorage`, which does not exist on the server. Required for RSC. |
| `server-only`              | Marker import that turns "this secret got bundled into the client" into a build error instead of a breach.             |
| `zod`                      | Runtime schema validation. TypeScript disappears at runtime, so env vars and Server Action input need real checks.     |
| `tailwind-merge`           | Resolves conflicting Tailwind classes so a `className` prop can actually override a component's defaults.              |
| `clsx`                     | Conditional class strings. Paired with `tailwind-merge` as `cn()`.                                                     |
| `class-variance-authority` | Type-safe component variants (`variant="destructive"`). How shadcn/ui components define their APIs.                    |
| `radix-ui`                 | Unstyled, accessible primitives — focus traps, keyboard nav, ARIA. What shadcn/ui components are built on.             |
| `lucide-react`             | Icon set. Tree-shaken via `optimizePackageImports`, so one icon does not pull in the library.                          |
| `tw-animate-css`           | Tailwind 4 animation utilities used by shadcn/ui (replaces `tailwindcss-animate`, which was Tailwind 3 only).          |

### Development

| Package                                           | Why                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `typescript`                                      | Type checking.                                                                                                       |
| `@types/node`, `@types/react`, `@types/react-dom` | Type definitions for the runtime and React.                                                                          |
| `tailwindcss`                                     | The CSS framework.                                                                                                   |
| `@tailwindcss/postcss`                            | Tailwind 4's PostCSS plugin. v4 moved the engine out of the main package.                                            |
| `eslint`                                          | Linter (flat config).                                                                                                |
| `eslint-config-next`                              | Next.js rules — React, hooks, jsx-a11y, and Core Web Vitals checks.                                                  |
| `@eslint/eslintrc`                                | `FlatCompat` shim; `eslint-config-next` still ships legacy-format config.                                            |
| `eslint-config-prettier`                          | Disables every ESLint rule that would fight Prettier. Must be last in the config array.                              |
| `prettier`                                        | Formatter. Removes formatting from code review entirely.                                                             |
| `prettier-plugin-tailwindcss`                     | Sorts Tailwind classes into canonical order, so the same styles always produce the same string and diffs stay small. |
| `shadcn`                                          | CLI that generates components into `components/ui/`. Not a runtime dependency — the generated code is yours.         |
| `supabase`                                        | Supabase CLI — local stack, migrations, type generation.                                                             |

### Transitive but notable

`sharp` (image optimisation in production) and `unrs-resolver` (ESLint's module
resolver) need native install scripts. npm 11 blocks those by default; both are
approved in the `allowScripts` field of `package.json`.

---

## What Phase 1 does not include

No schema, no migrations, no RLS policies, no auth flow, no product pages, no
cart, no checkout, no tests, no CI. The catalog routes in `lib/routes.ts` are
declared but not implemented — that is why the home page links nowhere.
