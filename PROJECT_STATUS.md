# Project Status

> **This file is the single source of truth for where the project stands.**
> It is updated at the end of every completed task. If this file and the code
> disagree, the code is right and this file is a bug — fix it immediately.

**Last updated:** 2026-08-05
**Version:** v0.4.0 (unreleased) — v0.1.0 is the last tag
**Phase:** 4A Authentication & authorization ✅ **Complete.** K-1 and K-2 both
closed; the panel is behind a real role check and the storefront has accounts.
**Overall progress:** ~72%

### Release status

| Item             | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| Latest tag       | **v0.1.0** — `7caf0ce`, released 2026-08-01              |
| Working version  | **v0.4.0**, Phase 4A — **not tagged**                    |
| Phase 2 commit   | `c6c3e5b`                                                |
| Phase 3A commit  | `e1ee841`                                                |
| Phase 3C commit  | `3023545`                                                |
| Phase 3D commit  | `87fa730`                                                |
| Branch           | `main`                                                   |
| Remote           | `origin` → https://github.com/urinboeveshonqul-svg/Bondo |
| GitHub sync      | ✅ synchronised                                          |
| Unpushed commits | none                                                     |

Nothing since v0.1.0 is tagged: step 6 of the release policy tags only when
instructed. **K-3 is now closed**, so the original reason not to tag v0.2.0 —
generated types that did not match the schema — no longer applies. Tagging is
waiting on the instruction, not on a blocker.

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

**Phase 3A — Premium UI & Storefront Foundation.** Complete.

The interface a customer sees, built end to end against mock data: a design
system in light and dark, a real header and footer, a ten-section landing page,
a catalog listing and a product detail page. No page touches Supabase.

**Phase 3 was split.** The roadmap's Phase 3 bundled the interface with auth,
services and database wiring, and was blocked on **K-3**. The brief for this
phase excluded the database explicitly, so the interface became **3A** and the
data work **3B**. That unblocks the UI without pretending K-3 is closed.

Two standing rules were overridden by the brief, both deliberately and both
recorded rather than quietly broken:

- **ADR-36** permits mock catalog data in `mocks/`, refining ADR-20. Scoped so
  it cannot leak past `app/` and `components/`, and tracked as **D-11**.
- **ADR-37** fixes orange to price reductions only, which cost the star rating
  and the low-stock label their accent colour.

Still open from earlier phases: **K-3** (types not generated) blocks 3B, and
**K-2** (no `/sign-in` page) is why the account control is a disabled button.

### Internationalization

Added after 3A closed, as a cross-cutting requirement rather than a phase:
**Uzbek (default), Russian, English**, with the locale in the URL (`/uz`, `/ru`,
`/en`).

Every string a visitor can read comes from `messages/<locale>/<namespace>.json`
— 8 namespaces × 3 locales, 169 keys each — except catalog copy, which carries
its three languages on the record itself (**ADR-39**). Prices, ratings and counts
are formatted per locale, and the listing count uses ICU plurals because Russian
needs three forms.

The policy is enforced, not documented: `npm run check` runs
`scripts/check-translations.mjs`, which fails on a missing namespace, a missing
key in either direction, an empty value, or a placeholder renamed in one
language. ESLint blocks `next/link`, because the locale-unaware version compiles,
renders, and silently resets the visitor's language on click.

Two Next.js routing defects were found and fixed while verifying this, both of
which failed **silently** — see **ADR-41** and **ADR-42**. Neither was specific
to i18n; both were pre-existing and only became visible because the 404 path was
being checked in three languages.

### Supabase integration (Phase 3B)

🟡 **Partially complete.** Two of the three blockers that stood in front of every
query are gone; the third is a schema gap that has to be closed with a migration.

**K-3 is closed.** `types/database.ts` is generated — 18 tables, 970 lines — by
`@supabase/postgres-meta`, the generator the Supabase CLI runs inside its
container, introspecting PGlite over the Postgres wire protocol (**ADR-48**).
`npm run db:types` now needs no Docker. Every `from()` in the project is
type-checked against the real schema for the first time.

**D-7 is paid.** The Phase 2 verification harness is committed and wired to
`npm run db:verify`, which is now part of `npm run verify`. It applies all 9
migrations to PGlite and makes **33 assertions** against `pg_catalog`: 18 tables,
RLS on every one, 45 policies, 34 foreign keys all with a delete rule, 58
indexes, every traversed foreign key indexed, 22 triggers including the two
append-only guards, `updated_at` maintained by a trigger on all 10 tables that
have it, all 6 `SECURITY DEFINER` functions pinning `search_path`, and
`products.search_vector` confirmed as a generated column.

**Seven services exist** — products, categories, brands, inventory, storage,
settings, audit — with real queries, explicit column lists, embedded selects
instead of N+1, in-query filtering and pagination, and one error mapper
(`lib/supabase-error.ts`) turning Postgres codes into `AppError`.

> **Nothing is wired to a page yet, and that is deliberate.** Three reasons, in
> order of how hard they are to remove:
>
> 1. **K-15** — the schema is single-language. Every content column is one
>    `text`; the UI models all of them as `LocalizedText`. Mapping a row onto the
>    UI's types today would mean inventing two languages.
> 2. **K-16** — the admin's publishing and inventory vocabularies do not match
>    the schema's enums.
> 3. **No project exists.** There is no `.env.local`, nothing is linked, and a
>    page that calls a service would fail at build time during static generation
>    — turning a working storefront into a failing build.
>
> The swap itself is one line per page once those are resolved; the services
> already return the shapes the pages need.

### Admin module architecture (Phase 3D)

🟢 **Complete.** Every module in the panel is now **described by a record**
rather than written as a screen. `lib/admin/modules.ts` holds one entry per
module — route, icon, navigation group, capability grants, form sections,
whether it is localized, whether it carries SEO, whether it has an audit trail —
and the sidebar, the mobile drawer, the breadcrumb root, the command palette,
the route guard and the form's section order are all derived from it.

`lib/admin/navigation.ts` used to hold a second copy of every module's href,
icon and permission list. It is now generated. **Verified**: the derived
navigation was compared against the previous hand-written lists for all five
system roles and the visible set is identical.

**Capabilities, not new permissions** (**ADR-55**). Screens ask seven questions —
`view`, `create`, `update`, `delete`, `publish`, `settings`, `export` — and each
module's `grants` table answers them by naming an existing database permission,
or `null` where the database has none. `null` is not "everyone may": it is "this
module does not offer that", which is how `audit.create` and `inventory.delete`
render as absent controls rather than buttons a trigger would refuse (ADR-24,
ADR-27). No permission was invented, which is ADR-44 still holding.

Capabilities are resolved **once** per route, server-side, by `guardModule()`,
which 404s rather than 403s — a 403 confirms which module to go phishing for.
Every client component takes the same `capabilities` prop, so the permission
model never reaches the browser and a screen cannot invent its own rule.

**One component kit**, in `components/admin/module/`: `ModuleHeader`,
`ModuleToolbar`, `ModuleSearch`, `ModuleFilters`, `ModuleColumnVisibility`,
`ModuleTable`, `ModuleBulkActions`, `ModulePagination`, `ModuleStatusBadge`,
`ModuleEmptyState`, `ModuleLoadingState`, `ModuleDeleteDialog`,
`ModuleDetailsDrawer`, `ModuleForm`, `ModuleTabs`, `ModuleCard`,
`ModuleMediaManager` / `ModuleImageUploader`, `ModuleLanguageTabs`,
`ModuleSeoPanel`, `ModuleAuditHistory`, `ModulePermissionGuard`,
`StatisticsCards` and the charts. Column visibility is new; everything else
existed in some form and was consolidated rather than rewritten.

**One form layout** (**ADR-56**): `general → media → pricing → inventory → seo →
localization → advanced → publish`. A module declares a subset in the registry
and fills it in; it cannot reorder or invent a section, because `sections` is
keyed by the canonical union. The product editor was rebuilt on it and is the
worked example.

**One folder convention**, spanning layers rather than collapsing them
(**ADR-58**): screens in `components/admin/modules/<id>/`, data access in
`services/`, mutations in `actions/`. The brief proposed colocating services and
actions under each module; that is refused and recorded, because a service
nested in a route folder is one somebody eventually imports React into, and
scattered Server Actions make "is every one validated" unanswerable by
inspection.

Documented in **[docs/admin/](docs/admin/)** — architecture, a start-to-finish
checklist for adding a module, the component reference, permissions, and
localization.

### Admin panel

A complete store-management interface on mock data: dashboard, products with
variants, categories, brands, inventory, homepage composition, static pages,
settings, team and roles, and the audit log. Thirteen routes × three locales.

**It was built out of roadmap order.** The roadmap places the admin at Phase 6,
behind cart, checkout and customer accounts; the brief asked for it now and
named it Phase 4. Recorded as **ADR-46** rather than done silently, because the
dependency it skips is real: with no `orders` table the dashboard's revenue,
order and customer figures are fixtures, and the order-management module the
roadmap's Phase 6 describes cannot exist yet.

**The authorisation model is the Phase 2 one, mirrored not reinvented.**
`lib/admin/permissions.ts` transcribes the 20 permissions and 5 system roles
from `20260801000200_identity_and_rbac.sql`, including the exact grant per role.
Navigation is filtered from it, and every route repeats the check — verified by
signing in as `inventory_manager`: the seven modules that role cannot use are
absent from the sidebar **and** return 404 when typed directly.

> ⚠️ **K-1 is not closed.** There is still no authentication. The panel is
> reachable in **development only**, gated by a `NODE_ENV` check that Next.js
> inlines at build time (**ADR-45**), and a production build redirects `/admin`
> to sign-in exactly as before — verified against `next start`. Every admin
> screen carries a banner saying the panel is unauthenticated and nothing
> persists. The real gate is a role check backed by RLS and it is still the
> first task of the auth phase.

---

## Overall progress

**~72%**

Nine phases, weighted by expected effort rather than counted equally — Phase 1
is a small phase and checkout is a large one. The number is an estimate and will
be revised as phases land.

```
Phase 1  Foundation                ████████████████████ 100%   ✅ complete
Phase 2  Database Foundation       ████████████████████ 100%   ✅ complete
Phase 3A Premium UI (mock data)    ████████████████████ 100%   ✅ complete
         Internationalization      ████████████████████ 100%   ✅ complete (uz/ru/en)
         Admin panel (mock data)   ████████████████████ 100%   ✅ complete (out of order — ADR-46)
Phase 3B Storefront Data Wiring    ██████████████░░░░░░  70%   (catalog is empty, not blocked)
         Localization in the DB    ████████████████████ 100%   ✅ complete (K-15, K-16)
         Admin module architecture ████████████████████ 100%   ✅ complete (Phase 3D)
Phase 4A Authentication            ████████████████████ 100%   ✅ complete (K-1, K-2 closed)
Phase 4  Cart & Checkout           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5  Customer Accounts         ░░░░░░░░░░░░░░░░░░░░   0%
Phase 6  Admin — data + auth       ░░░░░░░░░░░░░░░░░░░░   0%   (UI done; needs services, auth, orders)
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

### Design system (Phase 3A)

- 16 shadcn primitives; `button` kept the Phase 1 version rather than being
  overwritten by the generator.
- 12 project components: `ProductCard`, `ProductGrid`, `Price`,
  `DiscountBadge`, `Rating`, `StockIndicator`, `ProductImage`,
  `ProductCardSkeleton`, `EmptyState`, `Section`, `Container`, `ThemeToggle`.
- Colour: blue primary, neutral surfaces, orange for price cuts only (ADR-37),
  one green for in-stock. Semantic tokens (`--discount`, `--success`) defined
  for both themes rather than hard-coded per component.
- Light and dark via `next-themes`, class strategy, no flash on first paint.

### Pages

Home (10 sections), `/products` listing, `/products/[slug]` detail with 12
prerendered routes, 404, and both error boundaries.

### Verified

| Check                                  | Result                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`                       | passes — check, 76 schema assertions, production build                                                             |
| Schema assertions (`db:verify`)        | **76**, up from 70                                                                                                 |
| Translations                           | **14 namespaces × 3 locales, 747 keys each**                                                                       |
| First Load JS — home                   | **143 kB**                                                                                                         |
| First Load JS — listing / detail       | 120 kB / 131 kB                                                                                                    |
| First Load JS — admin dashboard        | 134 kB                                                                                                             |
| First Load JS — admin, heaviest        | 195 kB (brands: table + dialog editor)                                                                             |
| Shared JS                              | 103 kB                                                                                                             |
| Middleware bundle                      | **105 kB**                                                                                                         |
| Static prerendered routes              | **42**                                                                                                             |
| i18n runtime audit                     | 51/51 checks pass                                                                                                  |
| Admin runtime audit                    | 13 routes × 3 locales all 200; 0 untranslated keys; exactly 1 `h1` each; every link locale-prefixed; `noindex` set |
| Permission gating                      | verified as `inventory_manager`: 7 denied modules absent from nav **and** 404 on a typed URL                       |
| Admin closed in production             | verified — `307 → /<locale>/sign-in`, all 3 locales                                                                |
| 404 status and copy                    | 404 + localized, all 3 locales, both paths                                                                         |
| `<h1>` per page                        | exactly 1 on all 7 routes                                                                                          |
| Heading levels                         | no skipped level on any route                                                                                      |
| Dead links (`href="#"` or absent)      | 0                                                                                                                  |
| Internal link targets                  | 18, all resolve — 0 are 4xx                                                                                        |
| Buttons without an accessible name     | 0                                                                                                                  |
| `<img>` without `alt`                  | 0                                                                                                                  |
| Accent colour outside discounts        | 0 of 32 uses                                                                                                       |
| Security headers present at runtime    | yes, confirmed in browser                                                                                          |
| `x-powered-by` suppressed              | yes                                                                                                                |
| Anonymous → `/account/orders` redirect | yes, confirmed in browser                                                                                          |
| Fonts resolve to Geist                 | yes, confirmed in browser                                                                                          |
| Env/Zod absent from client chunks      | yes, confirmed by grep                                                                                             |

The accessibility and link rows are asserted against the **HTML the server
sends** for `/`, `/products`, three filtered listings, a product page and a 404
— not against a hydrated DOM. That is the stronger claim: it is what a crawler,
a screen reader on a slow connection and a client with JS disabled all receive.

**Not yet verified:** client-side behaviour — the theme toggle, the basket and
wishlist sheets, and the mobile navigation panel. They typecheck and build, and
their server markup is correct, but no interaction has been driven against a
real browser in this environment. Tracked as **D-13**.

**The two runtime audit rows predate the Phase 3D refactor.** The i18n and admin
audits were run against the pre-refactor panel and have **not** been re-run
against the module architecture — no browser has been driven in this session.
Every route still typechecks, lints, translates and builds, and the refactor was
composition rather than new behaviour, but "13 routes × 3 locales all 200" is a
claim about the previous code. Tracked as **D-20**.

---

## Language and copy

**Uzbek is the master language** (CLAUDE.md § 11a). Copy is written in Uzbek
first and then _adapted_ into Russian and English — never translated word for
word, because the sentence shape survives translation even when the words
change, and that is what makes a site feel foreign.

| Enforced mechanically                        | Left to review                       |
| -------------------------------------------- | ------------------------------------ |
| Detached Uzbek case suffixes (`{name} ni`)   | Register and tone                    |
| Infrastructure words in customer-facing copy | Whether a heading scans              |
| Transliterated technical names (`Нвидиа`)    | Whether a button reads naturally     |
| Key parity across all three locales          | Whether the three read independently |

`npm run copy:check` runs inside `npm run check`. It deliberately does not
grade tone: a checker that guessed would fail honest copy and train everyone
to ignore it.

### Fixed in the first pass

- **Six detached case suffixes** in Uzbek — `{name} ni`, `{amount} dan`,
  `{when} da`. Ungrammatical, and the signature of a sentence assembled from
  an English template.
- **A technical leak in all three languages.** The catalogue error named the
  product database to a shopper trying to buy a graphics card.
- **Wishlist vocabulary** — `sevimlilar` → `saralanganlar`, the word the
  standard names. Russian and English already used what their shoppers expect.
- **`Bondo'dan`** — an apostrophe before a case suffix on a foreign proper
  noun is a transliteration habit, not Uzbek orthography.
- **Ratings** read `4.8 / 5` rather than `5 balldan 4.8`, which reads like a
  school mark.
- **The home page, rewritten three times from the business idea** rather than
  from each other. Uzbek leads on who did the work, Russian on fit to task,
  English on the buyer's decision — different headings, different lengths, no
  shared punctuation. Errors, empty states and auth followed.
- **Seven more parallel strings** in the admin hints and catalog description,
  found by the structural check after the manual pass had missed them.
- **The hero paragraph** was one long sentence with an English em-dash aside;
  it is now two, which is how the Uzbek stores a customer already uses write.

### Fixed in the second pass — retail vocabulary

The first pass fixed structure. It left a **register** problem the checker
cannot see: copy that is grammatical, parallel-free and still does not sound
like a computer shop. `Komplektuvchilar foyda uchun emas, sifati uchun tanlanadi`
is the example — a slogan nobody would say out loud, built from words an
ordinary Uzbek shopper does not use.

A banned-vocabulary table is now in
[CLAUDE.md § 11a](CLAUDE.md#uzbek-vocabulary-use-the-words-shoppers-use). The
substitutions applied across storefront, admin and catalog copy:

| Removed                      | Replaced with                                |
| ---------------------------- | -------------------------------------------- |
| `komplektuvchilar`           | `butlovchi qismlar`                          |
| `tizim`, meaning a computer  | `kompyuter`                                  |
| `xarakteristikalar`          | `texnik xususiyatlar`                        |
| `konfiguratsiya` as a label  | `variant`                                    |
| `Ruxsati` for screen density | `Aniqligi` — `ruxsat` is permission          |
| `GGts`, `Gts`                | `GHz`, `Hz`                                  |
| `Bondo'dan`                  | `Bondodan`, and the heading rewritten around |

**Headings now state what they list.** `Shu oyda ko'p olinmoqda` →
`Ko'p sotilayotgan mahsulotlar`; `Chegirmalar` → `Chegirmadagi mahsulotlar`;
`Rasmiy hamkor brendlar` → `Mashhur brendlar`. The hero no longer carries a
slogan: it names what the shop sells and states the one fact that matters —
every computer is checked and stress-tested before it ships.

**The admin panel was held to the same standard.** Twelve strings named our own
infrastructure to an operator who has no reason to know it — `Supabase Storage`,
`service role`, `NEXT_LOCALE cookie`, `фикстуры`, `схема`, `bucket`. All twelve
now say what the operator can and cannot do. Three "clever" asides were cut,
including the one arguing that a form which loses your input is worse than an
empty one.

**Catalog copy was rewritten in the same pass** — twelve product descriptions,
four category descriptions and three reviews. The reviewers were also renamed:
`Marcus Reid`, `Priya Nandakumar` and `Tom Ashworth` on an Uzbek storefront read
as an untranslated template, whatever the review body says.

**Not claimed:** that every one of the 893 strings per locale has been
rewritten. Two passes have fixed the defects that are demonstrable — structural
in the first, lexical in the second — and added the gate that stops the
structural ones recurring. Register across the whole catalogue is **D-14**, and
it still needs a native speaker; the banned-word table narrows what a reviewer
has to catch but does not replace one.

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

| Layer       | May import                                                 | Must never import                                 |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `utils/`    | other `utils/`, `lib/site-config.ts`                       | env, Supabase, React, `lib/*`                     |
| `types/`    | other `types/`, `Locale` (type-only)                       | anything emitting runtime code                    |
| `lib/`      | `utils/`, `types/`                                         | `services/`, `actions/`, `app/`                   |
| `i18n/`     | `lib/site-config.ts`, `lib/routes.ts`, `types/`, next-intl | `services/`, `actions/`, `app/`, React components |
| `services/` | `lib/`, `types/`, `utils/`, Supabase clients               | React, `actions/`, `app/`                         |
| `actions/`  | `services/`, `lib/`, `types/`, `utils/`                    | `app/`                                            |
| `app/`      | everything                                                 | —                                                 |

The `lib` / `utils` / `types` split is by **dependency weight**:

- `utils/` are leaf modules. Importing one can never pull Zod, Supabase or React
  into a bundle.
- `lib/` is infrastructure that is allowed to have dependencies.
- `types/` emits no runtime code at all, so importing from it costs zero bytes.
  Its one import — `Locale` from `lib/site-config.ts` — is `import type` and
  erases completely.
- `i18n/` is the localization contract. It sits beside `lib/` rather than inside
  it because the middleware reaches it, so it inherits the Edge constraints:
  relative imports, and nothing that throws at module scope. `i18n/request.ts`
  is loaded by the framework and must not be imported by application code.

The locale table lives in `lib/site-config.ts` specifically because that file has
no imports. It is the only module all three of `utils/`, `i18n/` and the Edge
middleware chain are allowed to depend on, so putting the locale list anywhere
else would have meant duplicating it.

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

### Edge runtime constraints

`middleware.ts` is the only Edge Function. Three rules apply to it and to
everything reachable from it, and all three were learned from failed
deployments rather than from the docs:

| Rule                                              | Why                                               |
| ------------------------------------------------- | ------------------------------------------------- |
| Relative imports throughout the chain, never `@/` | ADR-34 — Vercel resolves this graph itself        |
| No import of `lib/env.ts`                         | ADR-35 — a module-scope throw kills every request |
| No `/** … */` inside `export const config`        | K-11 — Vercel's config parser mis-reads it        |

**`__dirname` / `__filename` audit (2026-08-01).** Scanned all 138 text files
by literal enumeration. They appear in exactly one source file:

```js
// eslint.config.mjs — CORRECT, do not "fix"
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });
```

Those are **local constants derived from `import.meta.url`** — already the ESM
replacement for the CommonJS globals, not a use of them. The file is loaded by
ESLint only; it is never imported by application code and never deployed.
Deleting these lines does not make anything more Edge-safe, it breaks linting,
because `FlatCompat` requires a `baseDirectory`.

The emitted Edge bundle (`.next/server/middleware.js`) contains **zero**
occurrences. The seven occurrences elsewhere in `.next/server/` are Next.js's
own ncc-bundled vendored dependencies (`__nccwpck_require__.ab = __dirname + "/"`)
inside CommonJS chunks that run in the Node.js server runtime, where `__dirname`
is defined — `.next/package.json` declares `"type": "commonjs"` and the root
`package.json` declares no `type`.

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

🟢 **Schema complete.** 🟢 **Types generated** (K-3 closed, ADR-48).
🟢 **Deployed to a hosted project.** 🟡 **The catalog is empty.**

| Item                | Status                                                                         |
| ------------------- | ------------------------------------------------------------------------------ |
| Hosted project      | 🟢 `pgxqnezwrwfgrmamlxhs` ("Bondo"), `ap-southeast-1`                          |
| Platform versions   | Postgres 17.6.1.155, PostgREST 14.15, GoTrue 2.195.0, Storage 1.67.26          |
| Migrations applied  | 🟢 **all 11**, local and remote in lockstep                                    |
| Schema drift        | 🟢 none — `db:types:remote` structurally identical to the committed file       |
| Tables              | 25, all with RLS enabled and explicit policies                                 |
| RLS policies        | 64 on `public`, 10 on `storage.objects`                                        |
| Indexes             | 75 on `public`                                                                 |
| Storage buckets     | 🟢 5, verified on the project with their size and MIME limits                  |
| Reference data      | 🟢 6 settings, 5 roles, 20 permissions, 41 grants — inserted by the migrations |
| Catalog data        | 🟡 **empty** — 0 products, categories, brands, pages, banners, admins          |
| Seed data           | development only, `supabase/seed.sql`; **never runs on `db push`**             |
| `types/database.ts` | 🟢 generated from the 11 migrations — 25 tables                                |

**Why the catalog is empty.** `supabase db push` applies migrations; it does not
run `supabase/seed.sql`, which is development fixture data guarded against
non-empty databases (ADR-25). The reference rows that _are_ present come from
`INSERT`s inside the migrations themselves. The storefront renders correctly
against this — an empty shop is a legitimate state, and the empty states ADR-20
protects are what appear.

**No administrator exists.** `admins` and `profiles` are both empty, so the
admin panel has nobody to authorise the moment **K-1** is closed.

### Tables

| Domain    | Tables                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity  | `profiles`, `admins`                                                                                                                              |
| RBAC      | `roles`, `permissions`, `role_permissions`, `user_roles`                                                                                          |
| Catalog   | `brands`, `categories`, `products`, `product_images`, `product_specifications`                                                                    |
| Inventory | `inventory`, `inventory_movements`                                                                                                                |
| Content   | `settings`, `site_banners`                                                                                                                        |
| Audit     | `audit_logs`                                                                                                                                      |
| Wishlists | `wishlists`, `wishlist_items`                                                                                                                     |
| Content   | `content_pages`                                                                                                                                   |
| i18n      | `product_translations`, `category_translations`, `brand_translations`, `banner_translations`, `content_page_translations`, `setting_translations` |

The six translation tables and `content_pages` arrived with **K-15**
(`20260804001000_localization.sql`). Four of them gained canonical, Open Graph
and card-type columns with `20260805001000_social_metadata.sql`, which is what
the reusable SEO panel renders (**ADR-57**).

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

🟢 **Complete.** Phase 4A delivered end to end and exercised against the
hosted project. **K-1 and K-2 are closed.**

| Item                                        | Status                                |
| ------------------------------------------- | ------------------------------------- |
| Sign up, sign in, sign out                  | ✅                                    |
| Email verification + resend                 | ✅                                    |
| Forgot password / reset password            | ✅                                    |
| Change password (asks for the current)      | ✅                                    |
| `/auth/callback` code exchange              | ✅ one handler for every link type    |
| Session refresh in middleware               | ✅                                    |
| Route protection + `redirectTo`             | ✅ verified in all three locales      |
| Admin role check (**K-1**)                  | ✅ a signed-in customer gets 404      |
| Profile + wishlist on registration          | ✅ trigger, in the signup transaction |
| Roles and permissions from the database     | ✅ `authorizationFor()`               |
| Admin bootstrap command                     | ✅ `npm run admin:bootstrap`          |
| Account pages — overview, profile, security | ✅                                    |
| Localized in uz / ru / en                   | ✅ 16 namespaces, 876 keys each       |

### The flow

```
register → trigger creates profile + default wishlist (one transaction)
         → Supabase emails a confirmation link
         → /auth/callback exchanges the code for a session
         → /verify-email confirms, or explains an expired link and resends

sign in  → GoTrue validates → middleware refreshes the token on every request
         → /account, or wherever `redirectTo` pointed

forgot   → email → /auth/callback → /reset-password (an authenticated change,
           so there is no token in the form to forge)
```

### Authorization

A **customer** holds no role: being a customer is the absence of an `admins`
row, and customer policies key off `auth.uid() = user_id` (ADR-59). **Staff**
hold roles, roles hold permissions, and `authorizationFor()` resolves both from
the database — memoised per request, never hardcoded. A deactivated
administrator resolves to zero roles _and_ zero permissions.

Three gates, and only the last one is the boundary:

| Gate                           | Does                                                | Worth                    |
| ------------------------------ | --------------------------------------------------- | ------------------------ |
| Middleware                     | Redirects anonymous requests off protected prefixes | Cheap first pass         |
| `requireUser` / `requireAdmin` | Redirects or 404s on the page                       | Defence in depth         |
| **RLS**                        | Refuses the query                                   | **The boundary** (ADR-4) |

### Bootstrap

```bash
npm run admin:bootstrap -- --email you@example.com --name "Your Name"
```

Creates the auth user (pre-confirmed), verifies the trigger made the profile
and wishlist, inserts the `admins` row, grants `super_admin`, reads the grant
back, and writes an `audit_logs` entry. Idempotent, and it **refuses to run**
when an active administrator already exists unless `--force` is passed. It is a
script and never a route: it needs `SUPABASE_SERVICE_ROLE_KEY`, and behind HTTP
"create the first admin" becomes "create an admin".

### Verified against the hosted project

| Check                                         | Result                                                         |
| --------------------------------------------- | -------------------------------------------------------------- |
| Registration through the public anon path     | accepted (mail rate-limited — **K-21**)                        |
| Profile created by the trigger                | ✅ with `full_name` from metadata                              |
| Default wishlist created                      | ✅ one row, `is_default`                                       |
| Customer holds no role and no admin row       | ✅                                                             |
| Sign-in after confirmation                    | ✅ access token issued                                         |
| Wrong password                                | ✅ `invalid_credentials`                                       |
| RLS — reads own profile only                  | ✅ 1 own, 0 others                                             |
| RLS — self-granting a role                    | ✅ refused, `42501`                                            |
| Sign-out clears the session                   | ✅                                                             |
| Bootstrapped admin resolves 20 permissions    | ✅                                                             |
| Deleting the user cascades the profile        | ✅                                                             |
| Anonymous → `/account`, `/admin`, `/checkout` | ✅ 307 to a localized sign-in with `redirectTo`, all 3 locales |
| **Signed-in customer → `/admin`**             | ✅ **404**, and at a deep admin route                          |
| **Bootstrapped admin → `/admin`**             | ✅ 200, and `/admin/products`                                  |
| Auth pages render                             | ✅ 200 with an `h1` in uz / ru / en                            |

Driven with real session cookies against `next start`, not mocked.

-------------------------------------- | ------------------------------------------------------- |
| Supabase Auth clients wired | ✅ |
| Session refresh in middleware | ✅ |
| Protected-route redirect | ✅ |
| `getCurrentUser()` with JWT validation | ✅ |
| `services/auth.service.ts` | ✅ sign-up/in/out, reset, update, resend, code exchange |
| `services/authorization.service.ts` | ✅ roles and permissions read from the database |
| Profile + wishlist on registration | ✅ trigger, in the signup transaction |
| Server Actions over the services | ❌ |
| Sign-in / sign-up pages | ❌ **K-2** |
| Forgot / reset password pages | ❌ |
| `/auth/callback` route handler | ❌ |
| Account pages | ❌ |
| Admin role check (**K-1**) | ❌ still open |
| Admin bootstrap command | ❌ |

**Why the boundary is here.** Closing K-1 means deleting `isAdminPreview`
(ADR-45), and deleting it before a `/sign-in` page exists makes the admin panel
unreachable in development as well as production. The role check and the
sign-in page have to land together, so neither is in this slice.

`lib/admin/permissions.ts` remains the transcribed constant the admin renders
against. `authorizationFor()` is its database-backed replacement and nothing
calls it yet; the swap happens when the admin layout gets its real check.
-------------------------------------- | ------ |
| Supabase Auth clients wired | ✅ |
| Session refresh in middleware | ✅ |
| Protected-route redirect | ✅ |
| `getCurrentUser()` with JWT validation | ✅ |
| Sign-in page | ❌ |
| Sign-up page | ❌ |
| Sign-out action | ❌ |
| OAuth callback handler | ❌ |
| Password reset | ❌ |
| User roles | ❌ |

`lib/routes.ts` declares `/sign-in`, `/sign-up`, `/sign-out`,
`/forgot-password` and `/auth/callback`. None of those pages exist yet, so the
middleware redirect currently lands on a 404 — correct behaviour for this phase,
resolved in Phase 2.

---

## Admin dashboard status

🟢 **Interface complete on mock data.** 🔴 **No authentication, no persistence.**

| Module           | Status                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| Layout           | ✅ sidebar (collapsible + drawer), top bar, breadcrumbs, notifications   |
| Global search    | ✅ command palette over 8 entity groups, `Ctrl`/`Cmd` + K                |
| Dashboard        | ✅ 6 stat cards, 2 SVG charts, low stock, recent orders, activity        |
| Products         | ✅ list with search/filter/sort/pagination/bulk; create, edit, duplicate |
| Variants         | ✅ axis editor + generated matrix, per-variant SKU/price/stock/weight    |
| Categories       | ✅ ordering (drag + keyboard), parent, visibility, localized copy        |
| Brands           | ✅ table + dialog editor, monogram, featured, visibility                 |
| Inventory        | ✅ levels + append-only movement ledger, adjustment records a movement   |
| Homepage         | ✅ section ordering and visibility, scheduled banners                    |
| Pages            | ✅ 8 static pages, localized title/summary/body + SEO                    |
| Settings         | ✅ 6 tabs — store, commerce, email, social, branding, hours              |
| Team and roles   | ✅ members, and the real grant table for all 5 system roles              |
| Audit log        | ✅ filterable, read-only by construction                                 |
| Authentication   | ❌ **K-1, K-2** — dev-only preview, see ADR-45                           |
| Persistence      | ❌ every form reports honestly that nothing was saved                    |
| Order management | ❌ needs an `orders` table, which arrives with checkout                  |
| Image upload     | ❌ needs Supabase Storage (**D-12**)                                     |

Everything is typed against `types/admin.ts` and `types/catalog.ts`, not against
`mocks/admin.ts`, so wiring services in changes the data source and nothing
else.

### The authorisation model it renders

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

The interface renders this model rather than describing it: the Team screen's
Roles tab prints the actual grant table from `lib/admin/permissions.ts`, so a
grant that drifts from the migration is visible on screen.

> ⚠️ **`/admin` is in `protectedRoutePrefixes`, but that list is authentication
> only.** Middleware proves a session exists; it does not check roles, because
> that needs a database read and putting a query on the Edge in front of the
> whole site is not a trade worth making. **Every signed-in customer clears the
> middleware gate for `/admin`.** The first task of the auth phase — and a
> prerequisite for the admin being reachable in production at all — is a role
> check in the admin layout, backed by RLS. This is the single place in the
> codebase where the route table implies more protection than it delivers, and
> it is called out in `lib/routes.ts` at the definition.
>
> Until then the panel is **development-only** (**ADR-45**). Verified against a
> production build: `/uz/admin`, `/ru/admin/products` and `/en/admin/settings`
> all answer `307 → /<locale>/sign-in`.

---

## Storefront status

🟢 **Interface complete on mock data.** 🔴 **Not connected to the database.**

| Item             | Status                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Design system    | ✅ 16 shadcn primitives + 12 project components, light and dark     |
| Root layout      | ✅ fonts, metadata, skip link, theme provider, toaster              |
| Home page        | ✅ 10 sections — hero, rails, brands, deals, value, reviews, signup |
| Product listing  | ✅ `/products`, filter by category and search term, empty state     |
| Product detail   | ✅ `/products/[slug]`, 12 prerendered, specs table, related rail    |
| 404 page         | ✅                                                                  |
| Error boundaries | ✅ route + root-layout                                              |
| Header           | ✅ sticky, search, categories menu, wishlist, basket, theme, mobile |
| Footer           | ✅ shop, support, company, social, newsletter                       |
| Search           | 🟡 submits to `?q=`, filters in memory; needs the search service    |
| Cart             | 🟡 panel with a real empty state; no cart service yet               |
| Wishlist         | 🟡 panel with a real empty state; no wishlist service yet           |
| Account / auth   | ❌ control is disabled — sign-in does not exist                     |
| Checkout         | ❌                                                                  |

**Every product on the site comes from `mocks/catalog.ts` (ADR-36).** No page
touches Supabase. `types/catalog.ts` is the contract between the two, so wiring
services in changes the data source and nothing else.

No dead links: `/products` and `/products/[slug]` exist because the home page
links to them. Controls whose destination does not exist yet — basket, wishlist
— open a panel showing a real empty state rather than navigating, and account is
a disabled button rather than a link to a 404.

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

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Severity                                                                          | Plan                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K-18 | ~~Every route returned 500 in production.~~ **Fixed.** `app/[locale]/layout.tsx` awaited `listCategories()` for the header menu. A layout renders on every route beneath it and **its own `error.tsx` cannot catch it** — `app/[locale]/error.tsx` renders _inside_ that layout — so one unreachable query escalated to `app/global-error.tsx` and replaced the whole document, on every URL including the 404. Reproduced against `next start`; fixed with `listNavigationCategories()`, which degrades to an empty menu and logs the failure.                                                                                                                                                                                                           | Resolved                                                                          | —                                                                                                                                                              |
| K-19 | **An exception thrown while rendering a Server Component page does not reach `app/[locale]/error.tsx`.** It aborts the shell before it flushes, so Next serves `app/global-error.tsx` — unbranded, unlocalized, whole document. Proven by probe: a bare `throw new Error()` at the top of the home page produced `<html id="__next_error__">`, never the route boundary. A Suspense boundary above the throw changes the outcome and makes it worse — `products/loading.tsx` flushed a skeleton and answered **200** with no content, the soft-error ADR-41 exists to prevent. Mitigated rather than removed: storefront pages read through `readCatalog()` and render `CatalogUnavailable` instead of throwing.                                          | Medium — it applies to any page that throws, not only catalog reads               | A page that must fail with a real 5xx needs its own answer. The constraint is documented at `readCatalog()` so the next author meets it before the outage does |
| K-20 | **The localized 404 does not render in production.** `/uz/<unknown>` answers 404 with the framework's built-in document — no `<html lang>`, no chrome, no translated copy — while the same URL under `next dev` renders `app/[locale]/not-found.tsx` correctly. Same shell-abort family as K-19: `notFound()` raised during the initial render aborts before the locale layout flushes, and the root `app/layout.tsx` is a passthrough rendering no `<html>` (ADR-42). Pre-existing and previously unobservable, because K-18 made every URL 500 before it could 404.                                                                                                                                                                                     | Medium — the **status** is correct; the body is bare                              | Needs the shell-abort behaviour understood first: the obvious fix reverses ADR-42. Deliberately not attempted speculatively                                    |
| K-1  | ~~`/admin` is protected by authentication only.~~ **Closed.** `requireAdmin()` in the admin layout reads the `admins` register and the role graph; `isAdminPreview` and the `NODE_ENV` gate (ADR-45) are deleted. Verified with real session cookies: a signed-in customer gets **404** at `/admin` and at a deep admin route, the bootstrapped administrator gets 200. RLS remains the boundary (ADR-4).                                                                                                                                                                                                                                                                                                                                                 | Resolved                                                                          | —                                                                                                                                                              |
| K-2  | ~~The sign-in page does not exist, so protected routes 404 after the redirect.~~ **Closed.** Sign-in, sign-up, forgot-password, reset-password and verify-email all exist and render in three locales; the redirect carries `redirectTo` and lands in the visitor's language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Resolved                                                                          | —                                                                                                                                                              |
| K-16 | ~~The admin's vocabulary diverges from the schema's enums.~~ **Closed.** `ProductStatus` and `MovementReason` now derive from `Enums<"…">`; `product_visibility` became the separate control the schema always had; the interface no longer offers `published`, `damage` or `recount`, none of which the database accepts. `npm run enums:check` fails the build on any recurrence.                                                                                                                                                                                                                                                                                                                                                                       | Resolved                                                                          | —                                                                                                                                                              |
| K-15 | ~~The schema cannot store the application's content model.~~ **Closed.** Migration `20260804001000_localization.sql` adds six normalized translation tables keyed `(entity, locale)`, a `public.locale` enum, per-locale `search_vector` columns and per-locale unique slugs. The single-language columns were migrated to `en` and **dropped**, so there is one place to write a name (**ADR-51**).                                                                                                                                                                                                                                                                                                                                                      | Resolved                                                                          | —                                                                                                                                                              |
| K-3  | ~~`types/database.ts` is stale.~~ **Closed.** Generated from the 9 migrations by `@supabase/postgres-meta` — the generator the Supabase CLI runs in its container — introspecting PGlite over the Postgres wire protocol (**ADR-48**). 18 tables, 970 lines, no Docker required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Resolved                                                                          | Re-run `db:types:remote` once a project is linked and treat any diff as schema drift.                                                                          |
| K-22 | ~~A user who had ever written an audit entry could never be deleted.~~ **Closed.** `audit_logs.actor_id` was `on delete set null` while the table carries a `before update or delete` append-only guard (ADR-27) — the cascade tried to UPDATE the audit row, the guard raised, and the whole `DELETE FROM auth.users` rolled back. It surfaced as an opaque GoTrue `500` with an empty body, naming neither the constraint nor the table. Every administrator writes audit entries by definition, so the entire staff register was undeletable. Fixed by `20260807001000_audit_log_independence.sql`: the foreign key is dropped rather than the guard weakened, so the log outlives its actors and keeps `actor_id` **and** `actor_email` (**ADR-61**). | Resolved                                                                          | —                                                                                                                                                              |
| K-21 | **Transactional email is Supabase's built-in mailer**, which is rate-limited to a handful of messages per hour and explicitly not for production. Measured: a registration was accepted and then failed at the mail step with `email rate limit exceeded`. Every flow that sends — confirmation, resend, password reset — is throttled by it, and under exhaustion the reset endpoint briefly became an enumeration oracle before that was closed (ADR-60).                                                                                                                                                                                                                                                                                               | **High — it gates launch, and it is invisible until a real user cannot register** | Configure a real SMTP provider in Project → Settings → Auth before any public traffic                                                                          |
| K-8  | **Buckets verified, policies still unproven.** All five buckets exist on the hosted project with the intended configuration — `products` 10 MB, `brands` 2 MB, `avatars` **private** 2 MB, `banners` 10 MB, `site-assets` 5 MB, each with its MIME allow-list. But `storage.objects` RLS is still unexercised: an anonymous list of the private `avatars` bucket returned `200 []`, which is what a _correct_ policy and a _broken_ one both return while the bucket is empty. Avatar folder scoping remains unproven.                                                                                                                                                                                                                                    | Medium                                                                            | Upload one object under `avatars/<user-id>/` and confirm a second user cannot read it                                                                          |
| K-9  | The seed's `auth.users` / `auth.identities` inserts follow the documented Supabase shape but were never run against real GoTrue. If the column set has drifted, `db:reset` fails on the seed — noisily, and only locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Low                                                                               | First real `npm run db:reset`                                                                                                                                  |
| K-10 | Trigram search (`sku % 'text'`) resolves only because Supabase puts `extensions` on the role search_path. A service that schema-qualifies nothing will break if that default changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Low                                                                               | Phase 3 — schema-qualify or use `extensions.similarity()`                                                                                                      |
| K-14 | **`next.config.ts`'s env preflight does not protect the Edge runtime.** The middleware is a standalone bundle; `next.config.ts` never executes there. A `NEXT_PUBLIC_*` variable that is _unset at build_ is not inlined and stays a runtime `process.env` read, so its runtime value was never validated by anything. Currently harmless — after ADR-35 the middleware reads only the two variables that **are** inlined — but it re-arms the moment anything in that chain reads a non-inlined variable.                                                                                                                                                                                                                                                | Medium (latent)                                                                   | Phase 9, alongside CI                                                                                                                                          |
| K-13 | ADR-34 (relative imports throughout the middleware chain) is enforced by a comment in two files and nothing else. Adding one `@/` import anywhere reachable from `middleware.ts` — including deep in a future service — breaks deployment with an error that names neither the rule nor the file that introduced it. A ~40-line script walked the graph and confirmed it is clean; it is not committed.                                                                                                                                                                                                                                                                                                                                                   | Medium — the chain grows with every phase                                         | Commit the graph check and wire it into `npm run check`; natural fit with CI in Phase 9                                                                        |
| K-12 | The production build is pinned to webpack because Vercel's Edge bundler cannot consume Turbopack's middleware output (ADR-33). Turbopack builds are the direction of travel, so this should be retested on future Next.js releases rather than assumed permanent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Low                                                                               | Retest each Next minor; revisit in Phase 9                                                                                                                     |
| K-11 | A `/** … */` JSDoc block **inside** the exported `config` object in `middleware.ts` breaks Vercel deploys with `Unhandled type: "ColonToken" :`. `@vercel/static-config` destructures a property's children positionally and JSDoc adds one. Fixed, and the constraint is documented at the site — but nothing mechanically prevents reintroducing it, and the error names neither the file nor the comment.                                                                                                                                                                                                                                                                                                                                              | Low (fixed, can regress)                                                          | Would need a lint rule; revisit in Phase 9 with CI                                                                                                             |
| K-4  | No Content-Security-Policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Medium                                                                            | Phase 4                                                                                                                                                        |
| K-5  | Middleware bundle is 162 kB (`@supabase/ssr` + `supabase-js`). Signed-in users pay Edge cold-start cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Low                                                                               | Monitor                                                                                                                                                        |
| K-6  | `allowScripts` in `package.json` is npm 11 syntax. A CI runner on npm 10 will not build `sharp`'s native binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Low                                                                               | Phase 9                                                                                                                                                        |
| K-7  | Header placeholder controls are `disabled`, so keyboard users find only the logo interactive in the header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Low                                                                               | Phase 3                                                                                                                                                        |

---

## Technical debt

| #    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Interest rate                                                                                                                                                                        | Pay down                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | No tests of any kind, and no CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | High — grows with every phase                                                                                                                                                        | Phase 9, but add tests alongside Phase 2+ work                                                                                                   |
| D-2  | `Paginated` / `PaginationParams` model offset pagination. Deep offsets and exact `COUNT(*)` do not hold at 50k products.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Medium                                                                                                                                                                               | Phase 3 — keyset pagination for storefront browse                                                                                                |
| D-3  | Zod re-enters the client bundle in Phase 3 when forms adopt `zodResolver`. Expected, but re-measure then.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Low                                                                                                                                                                                  | Phase 3                                                                                                                                          |
| D-4  | `components/ui/separator.tsx`, `skeleton.tsx` and both hooks are currently unimported.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Very low — zero bytes shipped                                                                                                                                                        | Naturally, as features land                                                                                                                      |
| D-5  | No route groups yet. `app/(storefront)`, `(account)`, `(admin)` are planned but empty ones today would be indirection with nothing behind them.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Low                                                                                                                                                                                  | Phase 3                                                                                                                                          |
| D-6  | No `robots.ts` or `sitemap.ts`. Correct for a one-page site; required before launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Low                                                                                                                                                                                  | Phase 3                                                                                                                                          |
| D-7  | ~~Migration verification lives in an uncommitted scratchpad harness.~~ **Paid.** Committed as `scripts/db-harness.mjs` + `scripts/db-verify.mjs`, wired to `npm run db:verify` and included in `npm run verify` — 33 assertions. The stub caveat stands: `auth` and `storage` are stubbed to the shape the migrations use, so this proves the `public` schema and not the platform (**K-8**, **K-9**).                                                                                                                                                                                                        | Resolved                                                                                                                                                                             | Re-run against a real stack when one exists and reconcile                                                                                        |
| D-8  | ~~No `product_variants` table.~~ **Closed.** `20260808001000_product_variants.sql` adds `product_options`, `product_option_translations`, `product_option_values`, `product_variants` and `product_variant_options` — the options → values → variants → combination shape, normalized rather than a `jsonb` blob (ADR-51's reasoning). Stock stayed in `inventory`, which gained a nullable `variant_id` so one ledger and one append-only guard serve both levels rather than a variant carrying its own quantity (ADR-24 holds — **ADR-62**).                                                               | Resolved                                                                                                                                                                             | —                                                                                                                                                |
| D-9  | No `currency` column. Prices are integer minor units of one store-wide currency (`settings.store.currency`). Multi-currency is explicitly out of scope, but adding the column after orders exist means backfilling history.                                                                                                                                                                                                                                                                                                                                                                                   | Low — while out of scope                                                                                                                                                             | Only if multi-currency is ever adopted                                                                                                           |
| D-11 | `mocks/catalog.ts` is the storefront's data source (ADR-36). Every day it stays, the chance grows that a component quietly depends on a shape the database does not produce.                                                                                                                                                                                                                                                                                                                                                                                                                                  | **High — this is the phase's main debt**                                                                                                                                             | Delete it the moment `services/products.service.ts` lands; `npm run check` then finds every call site                                            |
| D-12 | No product photography, so `next/image` is not yet used anywhere. Image optimisation, `sizes`, and priority hints are therefore unexercised — the first real image will be the first test of them.                                                                                                                                                                                                                                                                                                                                                                                                            | Medium                                                                                                                                                                               | With Storage-backed imagery                                                                                                                      |
| D-10 | `inventory.quantity_reserved` is declared but nothing writes it. Phase 4 needs it for oversell prevention; until then `quantity_on_hand` alone describes availability.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Low                                                                                                                                                                                  | Phase 4                                                                                                                                          |
| D-31 | **The Orders module has no screens.** The migration, `services/orders.service.ts`, `services/reviews.service.ts`, `actions/orders.actions.ts` and `actions/reviews.actions.ts` are complete and verified, and nothing renders any of them. The registry entry is held back on purpose so the sidebar does not link to a 404 (§ 5) — see the comment in `lib/admin/modules.ts` where it will go.                                                                                                                                                                                                               | **High — a data layer nobody renders is a data layer whose shapes are unproven.** The service returns what the screens were designed around, but no screen has yet disagreed with it | The next slice: `app/[locale]/admin/orders/` (list + detail), `/checkout`, `/checkout/success`, and the review form on the product page          |
| D-30 | **The basket exists but nothing fills it.** `components/cart/cart-provider.tsx` is complete — localStorage-backed, cross-tab, quota-safe — and `BasketSheet` still renders its empty state, because no product card or detail page calls `add()` yet.                                                                                                                                                                                                                                                                                                                                                         | Medium — the provider's API is unvalidated until a second caller uses it                                                                                                             | With the checkout slice; wiring is one `CartProvider` in the locale layout plus an add button                                                    |
| D-29 | The product **editor** still renders `mocks/admin.ts` shapes. The variant schema and `services/variants.service.ts` exist and are validated against the live database, but the form, the variant editor and the product detail page have not been re-pointed at them.                                                                                                                                                                                                                                                                                                                                         | **High — the gap between a real schema and a mock form is where a field silently stops matching a column**                                                                           | The next slice: map `ProductDetail` + `Variant` onto the editor and delete the mock product shapes                                               |
| D-28 | Variant images are modelled (`product_images.variant_id`) and nothing writes them. The media manager still uploads nothing at all (**D-12**), so per-configuration photography is schema-only.                                                                                                                                                                                                                                                                                                                                                                                                                | Low — it is a column, not a promise on screen                                                                                                                                        | With Storage-backed imagery                                                                                                                      |
| D-27 | Option **values** are not localized — "32GB", "RTX 5080" read identically everywhere and translating them would produce "32ГБ", which is wrong on a spec sheet and unsearchable. A colour axis is the arguable exception and is currently treated the same way.                                                                                                                                                                                                                                                                                                                                               | Low                                                                                                                                                                                  | Only if a non-specification axis (colour, material) is actually sold                                                                             |
| D-26 | The account has no avatar upload. `profiles.avatar_path` and the private `avatars` bucket both exist; the account page renders a monogram instead of a placeholder image, because a grey silhouette implies a feature that is not there.                                                                                                                                                                                                                                                                                                                                                                      | Low                                                                                                                                                                                  | With Storage-backed imagery (**D-12**)                                                                                                           |
| D-25 | "Sessions" on the security page is one session. Supabase does not expose a per-device list to an anon-key client — listing them needs the admin API and the service role, which must never reach a page. "Sign out everywhere" is offered, which is the capability that matters.                                                                                                                                                                                                                                                                                                                              | Low — a fake device list would be worse                                                                                                                                              | Only if Supabase exposes it to a user session                                                                                                    |
| D-24 | Interface language is the URL and the `NEXT_LOCALE` cookie; there is no per-user column. Correct today — but a transactional email has no URL to take its locale from, so one is needed the moment mail is templated.                                                                                                                                                                                                                                                                                                                                                                                         | Low                                                                                                                                                                                  | Phase 8, with transactional email                                                                                                                |
| D-23 | The email address is read-only on the profile page. Changing it re-runs verification and can leave an account addressable by neither the old nor the new address until a link is clicked; that needs its own flow with its own explanation.                                                                                                                                                                                                                                                                                                                                                                   | Low                                                                                                                                                                                  | Phase 5                                                                                                                                          |
| D-22 | "Remember me" stores the address for pre-fill and nothing else. Supabase's session lifetime is a project setting, not a per-request one, so the checkbox cannot shorten _this_ session — and the label says exactly what it does rather than implying otherwise.                                                                                                                                                                                                                                                                                                                                              | Low                                                                                                                                                                                  | Revisit if Supabase exposes per-session lifetimes                                                                                                |
| D-21 | The Phase 3D component kit ships several pieces nothing renders yet — `ModuleDeleteDialog`, `ModuleDetailsDrawer`, `ModuleLoadingState`, `ModuleImageUploader`. They exist because the brief specifies them and because the modules that need them (a delete that actually deletes, a list that actually fetches) are one phase away, but an unused component is an unproven one: its props are guesses until a second caller disagrees with them.                                                                                                                                                            | Low — no bytes shipped, but the API is unvalidated                                                                                                                                   | The first module that persists, in Phase 6. Adjust the props then rather than defending them                                                     |
| D-20 | The i18n and admin runtime audits (51 checks; 13 routes × 3 locales) were run against the **pre-refactor** panel and have not been re-run. The refactor was composition rather than new behaviour and everything typechecks, lints, translates and builds — but the audit rows in § Verified describe the previous code.                                                                                                                                                                                                                                                                                      | Medium — the claim gets staler with every module added                                                                                                                               | Re-run both audits when a browser is available; naturally paid alongside **D-13**                                                                |
| D-19 | The storefront and admin still render from `mocks/`, which now models content differently from the schema: mocks carry `LocalizedText` inline, the database keys it by `(entity, locale)`. The service layer folds between them, so the gap is bridged — but nothing exercises that fold against a real row.                                                                                                                                                                                                                                                                                                  | Medium — every mock-backed screen widens it                                                                                                                                          | Wiring the pages, which is the rest of Phase 3B                                                                                                  |
| D-18 | ~~The service layer is unexercised.~~ **Partially paid.** A hosted project exists (`pgxqnezwrwfgrmamlxhs`) with all 11 migrations applied, and the storefront's reads now run against it: `categories`, `brands` and `products` all return 200, with **every column and embedded select validated** against the live schema — `brands`, `categories`, `inventory` and all three `*_translations` embeds resolve. What remains unexercised is everything that needs rows or a session: the fold from translation rows onto `LocalizedText`, every write path, and RLS refusals for an authenticated non-admin. | Medium — down from High; the query _shapes_ are now proven                                                                                                                           | Populate the catalog, then work the assertion list in ROADMAP § Phase 3B                                                                         |
| D-17 | ~~Generated types describe the migrations, not a hosted project.~~ **Checked, no drift.** `db:types:remote` was run against the linked project and compared structurally with the committed file: **26 type entries, 103 columns and 19 enum values identical.** The only textual differences were formatting and an added `__InternalSupabase.PostgrestVersion`, so the committed file was kept. The harness still stubs `auth` and `storage`, so this proves the `public` schema only.                                                                                                                      | Low — down from Medium; re-check after any migration applied outside this repository                                                                                                 | Re-run `db:types:remote` after each `db push` and treat a structural diff as drift                                                               |
| D-16 | The admin is entirely non-persistent. Every form holds local state and reports honestly that nothing was saved; no Server Action exists. The shapes are the domain types, so wiring is a swap — but until then no workflow has been exercised end to end, and a form that looks right may still be missing a field the service needs.                                                                                                                                                                                                                                                                         | Medium — grows with each screen added                                                                                                                                                | With the admin services; each form's `onSubmit` becomes a `createAction()` call                                                                  |
| D-15 | `mocks/admin.ts` is the admin's data source (ADR-43), including an `orders` and `customers` shape that **no table backs** — those arrive with checkout. The dashboard's revenue and order figures are therefore illustrative, and labelled as such on screen.                                                                                                                                                                                                                                                                                                                                                 | **High — same class as D-11**                                                                                                                                                        | Delete alongside `mocks/catalog.ts`; the order shapes wait for the checkout phase                                                                |
| D-14 | **The copy has no native review.** The Uzbek and Russian are written rather than machine-translated, and `npm run copy:check` now fails the build on the mechanical tells — detached case suffixes, leaked infrastructure vocabulary, transliterated technical names. What it cannot judge is **register**: whether a sentence sounds like a person who sells computers in Tashkent. That needs a native speaker, and no automated check will replace one.                                                                                                                                                    | Medium — every new string compounds it, and wrong register is invisible to whoever wrote it                                                                                          | A native reviewer before any public launch. The strings are isolated in `messages/` and on catalog records, so a review is a self-contained pass |
| D-13 | No client-side behaviour has been driven against a real browser. The theme toggle, basket and wishlist sheets and mobile nav are verified only by typecheck, build and server markup. The preview pane injects the document via `innerHTML`, so the streamed inline scripts never run and the app never hydrates in it.                                                                                                                                                                                                                                                                                       | Medium — every added interaction widens the gap                                                                                                                                      | Phase 9's test suite; sooner if a real browser becomes available                                                                                 |

---

## Architectural decisions

Decisions with lasting consequences. **Do not reverse one without recording the
reversal here.**

| ID     | Decision                                                                                                                                                                                                                                                                                                                      | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-68 | **The default category taxonomy ships in a migration, not in `seed.sql`.** Twenty categories in three languages, inserted idempotently by `20260810001000_default_categories.sql`.                                                                                                                                            | ADR-20 forbids _fake_ data, and this is not fake: it is the shop's own taxonomy, decided by the business, and a computer store that sells laptops has a Laptops category the day it opens. The distinction that decides the file is deployability — `seed.sql` is development fixture data and never runs on `db push` (ADR-25), so reference data the application cannot function without has to be a migration, exactly as the roles and permissions in 20260801000200 already are. Inserted flat rather than nested because that is the list the business gave; `parent_id` and the `path` trigger already support nesting, so an operator can build a hierarchy without a migration. Keyed on the Uzbek slug for idempotency, because `categories` carries no name or slug of its own since the localization migration and there is nothing else on the parent to match. |
| ADR-67 | **Two permissions were added to the database — `orders.read` and `orders.update` — and no `orders.delete`.** Granted to `super_admin` (set-based, as ADR-44's migration does), `support_agent` (read + update) and `catalog_manager` (read). `support_agent`'s description changed from "Changes nothing" to match.           | ADR-44 forbids the _registry_ inventing a permission, not the schema gaining one — an Orders module needs the database to name what it offers before the interface may offer it. There is no delete because an order is never deleted: a sale that fell through is `cancelled`, which keeps the phone number, the basket and the reason, all three of which the shop wants when the customer rings back. The support agent got update because that role _is_ the workflow — the person who rings the customer is the person who moves the status, and a read-only support role would leave nobody able to work an order.                                                                                                                                                                                                                                                     |
| ADR-66 | **The review gate is an RLS policy, not an application check.** "Verified buyer, delivered order, one per purchased product" is a `with check` containing the `orders → order_items` join it depends on.                                                                                                                      | The rule is the feature, and a rule that lives in a Server Action protects that action rather than the table. Written as a policy it survives the next action somebody adds in a hurry, a leaked anon key, and `service_role` being handed to a script. `services/reviews.service.ts` translates the 42501 refusal into a sentence a shopper can read, and deliberately does **not** say which of the three conditions failed — telling a caller _why_ an authorisation check failed is how a probe learns the shape of somebody else's order. Verified: `db:verify` asserts all four outcomes under `set role authenticated` with a real JWT claim, not around RLS.                                                                                                                                                                                                         |
| ADR-65 | **`place_order()` is a `security definer` function and the only write path into `orders`. No role holds insert on `orders` or `order_items`.** It takes `[{product_id, variant_id, quantity}]` and **no prices**.                                                                                                             | Three holes close at once. Prices are re-read from the catalog inside the transaction that writes the row, so a client-supplied total cannot sell a laptop for a dollar. The order and its lines become one transaction, so no order exists with nothing in it. And a guest order — `user_id is null` — has no ownership for a table-level insert policy to check, so with one an anonymous caller could append lines to any other guest's order; a definer function inserts both halves itself and there is nothing to append to. The cost is that checkout logic lives in SQL, which is harder to test than TypeScript — paid down by `db:verify`, which places a real order and asserts the snapshot survives re-pricing the catalog.                                                                                                                                     |
| ADR-64 | **The basket is client-side only. There is no `carts` table**, reversing the roadmap's Phase 4 plan.                                                                                                                                                                                                                          | Phase 4 assumed server-side carts because it assumed online payment: a cart has to survive a redirect to a payment provider and come back. ADR-63 removed the provider, so a basket never leaves the tab it was filled in and the first thing worth persisting is the order. That drops anonymous cart sessions, merge-on-sign-in and an expiry job. The cost is real and accepted: a basket does not follow a shopper from desktop to phone. Reversible — the storage key in `components/cart/cart-provider.tsx` is the only coupling.                                                                                                                                                                                                                                                                                                                                      |
| ADR-63 | **Bondo takes no payment online. `order_status` tracks a conversation, not a transaction**, and the old interface vocabulary (`pending`, `paid`, `fulfilled`, `refunded`) is gone.                                                                                                                                            | This is how computer shops in Tashkent sell: the shopper leaves a phone number, a manager rings back to agree the configuration and the delivery, and cash settles at the door. Modelling it as a payment funnel with the payment step removed would leave `paid` as a column nobody updates and `delivery_fee_cents` guessed at checkout instead of quoted on the call. The seven statuses are each a sentence a manager can say out loud. Consequences: no payment provider, no webhook handler, no idempotency key — and `orders.phone` is required while email is not collected at all, because nobody here waits for a confirmation email.                                                                                                                                                                                                                              |
| ADR-62 | **Variant stock lives in `inventory`, which gained a nullable `variant_id`, rather than a `stock_on_hand` column on `product_variants`.** `variant_id IS NULL` is the product's own stock; not-null is that configuration's.                                                                                                  | The shortcut is a quantity on the variant row, and ADR-24 already says why it is wrong: two writable copies of a quantity are two quantities, and the ledger stops explaining the number. Keeping one table means one append-only guard, one movement type enum and one audit trail — re-proven at the variant level by `db:verify`, which now asserts that a direct write is refused and that a variant movement moves variant stock without touching the product's. The cost is that `inventory`'s primary key moved off `product_id` onto a surrogate, with two partial unique indexes carrying what the key used to mean; a plain `unique (product_id, variant_id)` would not work, because NULLs are distinct in a unique index and a product could acquire two product-level rows.                                                                                     |
| ADR-61 | **`audit_logs.actor_id` is deliberately not a foreign key.** The log does not depend on `auth.users` and keeps both `actor_id` and `actor_email` after an account is deleted.                                                                                                                                                 | It could not be one. `on delete set null` fires an UPDATE, and the append-only guard (ADR-27) rejects every UPDATE — so the two constraints made user deletion impossible, opaquely (**K-22**). Weakening the guard was the alternative and it is wrong twice: one exception is how a log stops being evidence, and nulling the actor erases the single field the row exists to hold. An audit entry whose actor disappears when the account closes cannot answer the only question ever asked of it. Erasure is still possible — it is now a deliberate redaction rather than a silent side effect of closing an account, which is what a data-protection request actually calls for.                                                                                                                                                                                       |
| ADR-60 | **The password-reset action swallows a rate-limit failure; every other action surfaces it.**                                                                                                                                                                                                                                  | The service surfaces rate limiting so a caller is never left clicking a button that is silently doing nothing. On the reset endpoint specifically that is an enumeration oracle: sending mail to a _known_ address consumes quota and errors, while an unknown address returns cleanly because no mail is attempted — so the error distinguishes the two. Found by measurement, not review: it appeared against the live project exactly when the mail quota was exhausted, which is also when an attacker would be probing. The visitor still sees the same confirmation either way, so nothing they could act on is hidden; the failure is logged server-side without the address.                                                                                                                                                                                         |
| ADR-59 | **Registration creates a profile and a default wishlist, and does not assign a "customer" role.** Both rows are written by `handle_new_user()` inside the signup transaction.                                                                                                                                                 | The Phase 4A brief asks for a default customer role and this schema has none, deliberately, since Phase 2. Roles exist to carry _staff_ permissions (ADR-21); a customer holds none, and every customer-facing policy keys off `auth.uid() = user_id` rather than a role (ADR-22). A permissionless `customer` row would grant nothing, be read by no policy, and be assumed load-bearing by the next person to see it — the same class of mistake as ADR-44, where the brief's role names did not match the schema's. Being a customer is the absence of an `admins` row. The wishlist, by contrast, is a real table with a real first use, so it is created — in the trigger rather than in application code, because a second call after `signUp()` can fail and leave the orphan the phase exists to prevent.                                                            |
| ADR-58 | **The per-module folder convention spans layers rather than collapsing them.** Screens live in `components/admin/modules/<id>/`; data access stays in `services/`, mutations in `actions/`, view models in `types/`, strings in `messages/`.                                                                                  | The Phase 3D brief proposed colocating `services/` and `actions/` inside each module folder. Two layer rules make that unsafe rather than merely unconventional: a service must never import React and must stay callable from a webhook, a job or a script, and a service nested in a route folder is one somebody eventually imports a component into; and Server Actions are public HTTP endpoints validated centrally through `createAction()`, so scattering them under `app/` makes "is every action validated" a question nobody can answer by looking. The convention is still identical for every module, which is what the brief was actually asking for — it just spans four folders instead of one. Recorded rather than resolved silently, because the next person reading the brief will ask why.                                                              |
| ADR-57 | **Canonical, Open Graph and card-type columns live on the translation row, and Twitter inherits from Open Graph rather than duplicating it.** Five columns per table — `canonical_url`, `og_title`, `og_description`, `og_image_path`, `twitter_card` — on `product_`, `category_`, `brand_` and `content_page_translations`. | The brief specifies canonical, Open Graph and Twitter fields in the shared SEO panel and the schema had none of them, so CLAUDE.md § 12 decides the order: migration first, then types, then the panel. Building the panel first is precisely **K-15** again — a form collecting data with nowhere to go. They are per-locale for the same reason `seo_title` is: a share card carries a headline and usually an image with words baked into it. Nine columns would be the naive shape; five plus a resolution chain (`twitter:title → og_title → seo_title → name`) is fewer places for the same sentence to drift, and a store that writes nothing still emits complete cards. `twitter_card` is an enum so `Enums<"twitter_card">` reaches the select and the interface cannot offer a value the insert rejects.                                                          |
| ADR-56 | **One form layout for every module**: `general → media → pricing → inventory → seo → localization → advanced → publish`. A module declares a subset; it never reorders and never invents.                                                                                                                                     | Enforced by the type rather than by review — `ModuleForm`'s `sections` prop is keyed by the canonical union and rendered in the order declared in `lib/admin/module.ts`, so writing them in a different order in the source changes nothing. The order runs from what the thing _is_ to whether the world can _see_ it, which puts the decisions with consequences last and identically placed in every module. Section titles default to `admin.form.sections.*`, so "General" is translated once instead of appearing as "Basics", "Details" and "Overview" across three modules. The product editor was rebuilt onto it as the worked example.                                                                                                                                                                                                                            |
| ADR-55 | **The interface speaks capabilities; the database keeps its permissions.** Seven capabilities per module (`view`, `create`, `update`, `delete`, `publish`, `settings`, `export`), each mapped by the module's `grants` table to an existing permission or to `null`.                                                          | ADR-44 forbids inventing role or permission names for the UI, and it should: the twenty permissions are the schema's and a trigger protects them. But a uniform interface needs a uniform question, so the indirection gives every module the same seven questions without the database gaining a single new answer. `null` carries real information — it means the module does not offer that capability **to anybody**, super admin included, which is exactly true of `audit.create` and `inventory.delete` where a trigger refuses the write regardless of policy (ADR-24, ADR-27). Resolving capabilities once per route and passing the _answers_ down means the permission model never reaches the browser.                                                                                                                                                           |
| ADR-54 | **Every admin module is a record in `lib/admin/modules.ts`**, and navigation, route guards, form sections and permission checks are derived from it rather than maintained beside it.                                                                                                                                         | `lib/admin/navigation.ts` was a second hand-written list of every module's href, icon and permission set. Two lists, one of them edited, is how a module ends up reachable from the command palette and missing from the sidebar for one role — and the panel gains a module roughly every phase, so the number of chances grows. The failure modes this closes are the quiet ones: an ungated delete button, a nav entry that 404s, a form section in a different place. Verified rather than assumed: the derived navigation was compared against the previous lists for all five system roles and the visible set is identical. Cost: adding a module now requires editing a file that every module shares, which is the trade — one place to get right instead of six places to keep in step.                                                                            |
| ADR-1  | One-directional flow: component → service → Supabase.                                                                                                                                                                                                                                                                         | A component that queries directly is a query the team cannot find later. This is the constraint the whole structure rests on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-2  | Money stored as **integer minor units** (cents).                                                                                                                                                                                                                                                                              | Floating point does not belong near a price. Enforced by `formatPrice()` taking minor units.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ADR-3  | Slugs persisted on the row, never derived on read.                                                                                                                                                                                                                                                                            | Deriving a slug on read means renaming a product silently breaks every existing link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-4  | RLS is the authorisation boundary. Server checks are defence in depth.                                                                                                                                                                                                                                                        | The anon key is public. Anything not enforced by RLS is not enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-5  | `getUser()` everywhere; `getSession()` never.                                                                                                                                                                                                                                                                                 | `getSession()` trusts the cookie as-is and can be spoofed. `getUser()` validates the JWT against the Auth server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-6  | Server Components by default; `"use client"` pushed as far down the tree as possible.                                                                                                                                                                                                                                         | Client JS is opt-in, not the default. This is what keeps First Load JS near the framework floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ADR-7  | `lib/env.ts` is the environment contract; only `next.config.ts` and `lib/logger.ts` read `process.env` directly, both documented at the point of use.                                                                                                                                                                         | Fail fast at boot with a readable message, rather than `undefined` deep inside a request three weeks later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-8  | `lib/logger.ts` must not import `lib/env.ts`.                                                                                                                                                                                                                                                                                 | It is imported by Client Components. The import chain put Zod and the env schema in the shared client bundle — 67 kB, measured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-9  | `types/` contains declarations only; runtime helpers live in `lib/`.                                                                                                                                                                                                                                                          | Importing from `types/` must be provably free. `ok()`/`err()` moved to `lib/result.ts` for this reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-10 | `utils/` may not import env, Supabase or React.                                                                                                                                                                                                                                                                               | A formatter that drags Zod into the bundle every time a price renders is not a utility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-11 | Middleware skips Supabase entirely for requests with no `sb-*-auth-token` cookie.                                                                                                                                                                                                                                             | Most storefront traffic is anonymous. Calling `getUser()` for them adds a round trip to Auth on every page view and burns auth quota.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-12 | `createClient()` and `getCurrentUser()` memoised with React `cache()`.                                                                                                                                                                                                                                                        | Per-request, not cross-request. Six components asking for the user cost one JWT validation, not six.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-13 | `createAction()` calls `unstable_rethrow()` before handling any error.                                                                                                                                                                                                                                                        | `redirect()` and `notFound()` signal by throwing. Catching them turns a redirect into "Something went wrong."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-14 | Middleware does authentication only, never authorisation.                                                                                                                                                                                                                                                                     | Role checks need a database read. A query on the Edge in front of the whole site is not a trade worth making.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-15 | No canonical URL in the root layout.                                                                                                                                                                                                                                                                                          | A root canonical is inherited by every page that does not override it, telling crawlers the whole catalog duplicates one URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-16 | `NEXT_PUBLIC_SITE_URL` optional, falling back to `NEXT_PUBLIC_VERCEL_URL` then localhost.                                                                                                                                                                                                                                     | Preview deployments get a hostname that cannot be known in advance. Without the fallback every preview emits production URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-17 | `next.config.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` is missing.                                                                                                                                                                                                                                                           | An empty `remotePatterns` list builds fine and 404s every product image in production — a failure that reaches customers before developers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-18 | No root `app/loading.tsx`.                                                                                                                                                                                                                                                                                                    | Both pages are static. A root loading file flashes a fallback on every navigation and buys nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-19 | `lib/utils.ts` stays where it is despite the `lib`/`utils` overlap.                                                                                                                                                                                                                                                           | `components.json` and every generated shadcn component import `cn` from `@/lib/utils`. Moving it fights the generator forever.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-20 | No fake or seeded data, in any phase. **Refined by ADR-25.**                                                                                                                                                                                                                                                                  | Placeholder data hides empty states, and empty states are where ecommerce UIs actually break.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-21 | Permissions are never held by a user directly. Users hold roles; roles hold permissions.                                                                                                                                                                                                                                      | At 100+ administrators, per-user grants become impossible to audit. Revoking a capability from everyone must be one DELETE, not a migration over users.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-22 | Staff status lives in its own `admins` table, not an `is_admin` column on `profiles`.                                                                                                                                                                                                                                         | `profiles` is the one table customers may UPDATE. A privilege flag on it is one mis-scoped policy away from self-service privilege escalation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-23 | Every RLS helper is `SECURITY DEFINER` with `set search_path = ''` and fully schema-qualified references.                                                                                                                                                                                                                     | DEFINER is required — a policy on `user_roles` that queries `user_roles` recurses forever. The pinned search_path stops a caller shadowing `public.admins` with their own table and having it read with elevated rights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-24 | Stock lives only in `inventory`. `products` has no stock column, and `inventory.quantity_on_hand` may change only through an `inventory_movements` insert — enforced by a trigger that rejects every other write.                                                                                                             | Two writable copies of a quantity are two quantities. The guard makes "never overwrite inventory silently" a mechanism rather than a policy: a Studio edit raises an exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-25 | **Refines ADR-20.** Development-only seed data is permitted in `supabase/seed.sql`, which runs on local `db reset` only and aborts if the database already holds products or admins.                                                                                                                                          | ADR-20's reasoning was about content the storefront ships — placeholder products hiding empty states. A local fixture never reaches a user, and Phase 2 has no UI for it to hide. The abort guard is what keeps the distinction real rather than intended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-26 | Category nesting stores a trigger-maintained `path uuid[]` alongside `parent_id`, with a GIN index.                                                                                                                                                                                                                           | `parent_id` alone needs a recursive CTE per page view. The path pays that cost once per write, and writes are rare. Cycles are rejected at the trigger, because a cycle in a category tree is an infinite loop in every breadcrumb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-27 | `audit_logs` and `inventory_movements` are append-only, enforced by a trigger rather than by the absence of an RLS policy.                                                                                                                                                                                                    | RLS does not constrain `service_role`. An audit log that anyone holding the service key can rewrite is not evidence of anything.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ADR-28 | Anonymous read extends to visible categories, brands, published-product images/specs, public settings and live banners — not products alone.                                                                                                                                                                                  | A product page must name its brand and the nav must list categories. Restricting these to `service_role` would move the whole storefront off RLS, which is the opposite of the intent. Recorded because the Phase 2 brief said "read published products only".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-29 | `types/database.ts` was left stale rather than hand-written when the generator could not run.                                                                                                                                                                                                                                 | An empty `Tables` makes every `from()` a compile error, so the gap fails loudly. Fabricated types would be plausible, wrong, and unchecked — and would break the rule that this file is generated output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-30 | GRANTs are written out explicitly instead of relying on Supabase's default privileges.                                                                                                                                                                                                                                        | A privilege model that exists only as a platform default is one nobody can review. `anon` gets SELECT on exactly the seven tables with an anonymous read policy, so a mistaken policy still meets a closed second gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-37 | Orange is used for **price reductions only** — the sale price, the discount badge. Star ratings are monochrome and low stock is emphasised with weight, not hue.                                                                                                                                                              | An accent that means two things means neither. An amber star next to an orange sale price makes a well-reviewed product look discounted at a glance, which is the one misreading a storefront cannot afford. Verified in the rendered page: zero accent-coloured stars, 36 accent elements and all of them a price cut.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-50 | **Database-first**: the schema is the source of truth, enums in `types/` derive from `Enums<"…">`, and `npm run enums:check` fails the build on divergence. Vocabularies with no column yet are allowed but must be declared with a reason.                                                                                   | Stated as policy by the user and adopted as CLAUDE.md § 12. It is worth mechanical enforcement because the failure is silent and late: a hand-written union compiles, renders a `<Select>`, and is rejected by the enum at insert — in production, on a value the operator was offered. **K-16** was exactly that, and it survived a whole phase because nothing compared the two. Adopting the policy closed it: `product_status` and `inventory_movement_type` are now derived, and `product_visibility` became the separate control the schema always had. The declared-exception list keeps honest gaps (no `orders` table yet) visible rather than indistinguishable from mistakes.                                                                                                                                                                                     |
| ADR-53 | Localized content is **not publishable until every supported language has copy**, enforced in the service layer by `isPublishable()` and surfaced by the same `coverageOf()` the form renders.                                                                                                                                | A product live in one language puts an untranslated page in front of a shopper in the other two, which is the failure the whole translation architecture exists to prevent. Putting the rule in the service rather than the form means it also holds for an import script, and sharing one function with the UI means a form that says "complete" and a save that refuses can never disagree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-52 | Slugs are **per locale**, unique within a locale rather than globally, and the parent's `slug` column was dropped.                                                                                                                                                                                                            | A Russian shopper's URL should read as Russian, and `/ru/products/videokarta-rtx-4090` is only expressible if the slug lives on the translation row. Uniqueness is scoped to the locale because "monitor" may legitimately be one product's Uzbek slug and another's English one. Keeping a canonical slug alongside would leave the application choosing between two sources of truth — the duplicate concept this phase removed. Routing adopts it when the storefront is wired; the column is populated and unused until then.                                                                                                                                                                                                                                                                                                                                            |
| ADR-51 | Translations are **normalized rows**, one per `(entity, locale)`, not a `jsonb` blob — and the single-language columns were dropped rather than kept alongside.                                                                                                                                                               | A blob cannot be constrained (`name` NOT NULL per language), cannot carry a per-locale `tsvector`, and cannot have a unique index on a localized slug. It also makes `where locale = 'ru'` a scan with no statistics instead of a query. Dropping the old columns is the harder half and the more important one: two places to write a product name is exactly the duplicate concept K-15/K-16 were. Existing rows are migrated to `en` in the same migration, so no deployment observes both shapes.                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-49 | Services take a Supabase client as an argument and never construct one; every read uses an explicit column list, never `select("*")`.                                                                                                                                                                                         | The caller is the only thing that knows whether a query should run as the visitor (RLS enforced) or as the service role (RLS bypassed). A service that constructs its own client picks for every future caller, and the first reuse silently bypasses authorisation. Explicit columns matter for a second reason here: `products.search_vector` is a `tsvector` that nothing renders, and `select("*")` ships it on every row of every listing.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-48 | `types/database.ts` is generated by running `@supabase/postgres-meta` against PGlite over the Postgres wire protocol, rather than by `supabase gen types`.                                                                                                                                                                    | `supabase gen types` runs its generator in a container **even with `--db-url`**, and this machine has no container runtime — which is what kept **K-3** open through three phases and blocked every query in the project. `postgres-meta` is the package that container runs, and the two calls made here (`getGeneratorMetadata` then the TypeScript template) are exactly what its `/generators/typescript` route does. So the output is generated by the official generator from the real migrations, not hand-written. It reflects the migrations rather than a hosted project: `db:types:remote` remains the authority once one is linked, and a diff means drift.                                                                                                                                                                                                      |
| ADR-47 | Product `name` became `LocalizedText`, and `mocks/catalog.ts` gained a `modelName()` helper for the identical case.                                                                                                                                                                                                           | The brief lists Product Name as a localized field, and it is right to: "Bondo Forge RTX 4080 Gaming PC" is "Игровой компьютер Bondo Forge RTX 4080" in Russian. Manufacturer model numbers are the exception — "RTX 4090" is a trademark and identical everywhere — so `modelName()` declares the three copies once rather than inviting one of them to drift. This reversed the Phase 3A decision to treat product names as identifiers; it touched ten files and was authorised by the brief (CLAUDE.md § 2).                                                                                                                                                                                                                                                                                                                                                              |
| ADR-46 | The admin panel was built now, out of roadmap order — the roadmap places it at Phase 6, behind cart, checkout and accounts.                                                                                                                                                                                                   | The brief asked for it and named it Phase 4. Recorded rather than done quietly because the skipped dependency is real and shows in the result: with no `orders` table the dashboard's revenue, order and customer figures are fixtures, and the order-management module Phase 6 describes cannot be built. The roadmap is reordered rather than rewritten, so the debt stays visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-45 | The admin is reachable in **development only**, gated by `NODE_ENV` inside the middleware chain. Production behaviour is unchanged: `/admin` redirects to sign-in.                                                                                                                                                            | Without it the panel could not be built at all — `/admin` is a protected route, there is no `/sign-in` page (**K-2**), so every request 404s after the redirect. `NODE_ENV` is inlined as a literal by Next.js, so the production bundle contains `false` rather than a check: there is no runtime variable to misconfigure and the branch is unreachable in a deployed build. **It is not authorisation and does not close K-1** — it is deleted when the real role check lands. Verified against `next start`: all three locales answer `307 → /<locale>/sign-in`.                                                                                                                                                                                                                                                                                                         |
| ADR-44 | The admin renders the Phase 2 authorisation model transcribed into `lib/admin/permissions.ts`, rather than inventing role names for the UI.                                                                                                                                                                                   | The brief named five roles (Owner, Super Admin, Admin, Inventory Manager, Content Manager) that do not match the five the schema ships and a trigger protects. Inventing a parallel vocabulary would mean the interface offers capabilities the database refuses. The constant carries the exact grants from the migration, the Roles screen prints them, and the union type is what will check the eventual query. Divergence is the risk to watch; a test can assert the two sets match once **K-3** is closed.                                                                                                                                                                                                                                                                                                                                                            |
| ADR-43 | **Extends ADR-36.** `mocks/admin.ts` is permitted, on the same terms, and derives its product list from `mocks/catalog.ts` rather than duplicating it.                                                                                                                                                                        | One product list, so a product edited in the admin cannot disagree with the same product on the storefront — which is also the relationship the real system has: one `products` table, two projections. Dates are derived from a fixed epoch rather than `Date.now()`, because a module-scope "3 hours ago" differs between server and client and fails hydration, and freezes at build time when prerendered.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-42 | An unmatched URL under a locale is caught by `app/[locale]/[...rest]/page.tsx`, which calls `notFound()`; `app/layout.tsx` exists as a passthrough that renders no markup.                                                                                                                                                    | Two separate Next.js facts, both discovered by observation rather than from the docs. A `not-found.tsx` inside a segment only catches `notFound()` raised by a route that **matched** — an unknown path matches nothing, so it fell through to the framework's built-in English 404 with no `<html lang>`. And with no root `app/layout.tsx`, the `not-found` convention has no root to resolve against and `app/[locale]/not-found.tsx` is ignored entirely: an unknown product slug returned **200 with an empty body**, silently, with nothing logged in dev or production.                                                                                                                                                                                                                                                                                               |
| ADR-41 | `dynamicParams = false` on `app/[locale]/products/[slug]`.                                                                                                                                                                                                                                                                    | Correctness, not caching. `products/loading.tsx` puts a Suspense boundary above the route, so the response shell flushes with **200** before the page body runs and the `notFound()` inside it can no longer change the status — a soft 404 that invites dead product URLs into the search index. Refusing unknown params up front makes Next.js answer 404 before streaming starts. Revisit when the catalog outgrows build-time prerendering: ISR needs `true`, and the soft 404 must then be solved by moving `loading.tsx` off this route.                                                                                                                                                                                                                                                                                                                               |
| ADR-40 | Locale is **always** in the URL, including the default: Uzbek lives at `/uz`, never at `/`. Persisted in `NEXT_LOCALE`, negotiated from `Accept-Language` only when no cookie exists.                                                                                                                                         | An unprefixed default gives every Uzbek page two addresses, which costs a canonical tag on every route to stop crawlers treating the site as duplicated, and makes `hreflang` a special case for one locale out of three. One shape for all three is worth one redirect from `/`. Cookie before `Accept-Language` because an explicit choice must outrank a browser default — verified: a `NEXT_LOCALE=uz` cookie beats an `en-GB` header.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-39 | **Interface chrome lives in `messages/`; catalog copy lives on the record** as `LocalizedText` (`Record<Locale, string>`). Specification labels are the exception — a shared vocabulary keyed into the `product` namespace.                                                                                                   | They are different things with different authors and different lifecycles. "Add to basket" is written once by a developer, is identical on every page, and changes with a deploy. A product description is written per row by a merchandiser and in Phase 3B comes from the database — putting it in a message file would build the wrong pattern and then require unpicking. Making `LocalizedText` a **required** record of every locale means a product cannot be added in one language: TypeScript rejects it, which is the compile-time half of the policy in CLAUDE.md § 11. Spec labels go the other way because "Capacity" appears on memory, storage and batteries alike — three translations beat the same three on every row.                                                                                                                                     |
| ADR-38 | next-intl, with `[locale]` as the routing segment, rather than a hand-rolled context or a heavier framework.                                                                                                                                                                                                                  | It is the only option that gives ICU plurals, Server-Component-native translation (`useTranslations` works without a client boundary, so a grid of sixty product cards still ships zero JavaScript for its text), and locale-aware `Intl` formatting from one contract. A hand-rolled system reaches the same place eventually and arrives without plural rules — Russian needs `few` and `many`, which a ternary cannot express. Cost: the middleware bundle grew 93 kB → 105 kB.                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-36 | **Refines ADR-20.** Mock catalog data is permitted in `mocks/`, imported only by `app/` and `components/`, for the interface phase only.                                                                                                                                                                                      | ADR-20 forbids fake data because it hides empty states. The Phase 3A brief requires building the interface before the schema is wired, so the exemption is scoped: nothing in `services/`, `actions/` or `lib/` may import it, the shapes are `types/catalog.ts` so services drop in without touching components, and the empty states ADR-20 protects are built and reachable today — an empty basket, an empty wishlist, a filter matching nothing. Tracked as **D-11** so the folder is deleted rather than forgotten.                                                                                                                                                                                                                                                                                                                                                    |
| ADR-35 | **The middleware chain does not import `lib/env.ts`.** `supabase/session.ts` reads its two `NEXT_PUBLIC_*` values from `process.env` directly. Same shape as ADR-8 for `lib/logger.ts`, applied to the Edge bundle.                                                                                                           | `lib/env.ts` validates the whole public contract with Zod **at module scope and throws**. In an Edge Function module scope runs once per isolate, so a throw there fails _every_ request and Vercel surfaces it only as `MIDDLEWARE_INVOCATION_FAILED` — no file, no line, no variable. It also validated `NEXT_PUBLIC_SITE_URL`, which nothing in this chain uses, and which is **not inlined when unset at build**: it stayed a runtime `process.env` read whose value the build never checked, and `next.config.ts` does not run inside the Edge Function. Measured: middleware bundle 383 kB → 325 kB, Zod removed entirely.                                                                                                                                                                                                                                             |
| ADR-34 | **Every module reachable from `middleware.ts` imports by relative path, not the `@/` alias.** The rest of the codebase keeps the alias.                                                                                                                                                                                       | Vercel resolves the middleware import graph itself when packaging the Edge Function — from source, transitively, without applying tsconfig `paths`. Anything it cannot resolve fails the deployment with `The Edge Function "middleware" is referencing unsupported modules`. Proven by converting only the entry file: the error moved one level down, from `middleware.js: @/supabase/session` to `supabase/session.js: @/lib/env, @/lib/routes`. Type-only imports are erased before resolution and were never named, but are converted too, since one edit turning one into a value import would break the deploy for a reason nobody would connect to that line. Chain today: `middleware.ts` → `supabase/session.ts` → `lib/env.ts`, `lib/routes.ts`, `types/database.ts`.                                                                                             |
| ADR-33 | The production build uses **webpack**; `--turbopack` is kept on `dev` only.                                                                                                                                                                                                                                                   | Vercel's Edge bundler expects `.next/server/middleware.js`. Turbopack emits no such file — it emits three chunks, one named `[root-of-the-server]__….js`, and Vercel then fails with `The Edge Function "middleware" is referencing unsupported modules: @/supabase/session`. Webpack also measured smaller here: First Load JS 139 kB → 103 kB, middleware 162 kB → 109 kB. `dev` keeps Turbopack, where the speed matters and nothing is deployed. Revisit per **K-12**.                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-32 | Env URLs are validated with `z.url({ protocol: /^https?$/ })` — scheme restricted, host **not** — plus an explicit scheme check in the preflight; and a value with leading or trailing whitespace is rejected rather than trimmed.                                                                                            | Plain `z.url()` and `URL.canParse()` accept `postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres`, the connection string Supabase shows beside the project URL; it would validate and then fail at the first query. `z.httpUrl()` fixes that but also demands a public-looking domain, rejecting `http://localhost:3000` and `http://127.0.0.1:54321` — the local Supabase URL `.env.example` prescribes. Restricting the scheme was the requirement; restricting the host broke local development. Whitespace from a paste survives every truthiness and length check, making a credential quietly wrong at runtime; trimming silently would hide the mistake from whoever can fix it at source.                                                                                                                                                                     |
| ADR-31 | **Extends ADR-17.** `next.config.ts` preflights the whole required public env set, not only `NEXT_PUBLIC_SUPABASE_URL`, and reports every problem at once.                                                                                                                                                                    | A missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` was not caught until page-data collection, where `lib/env.ts` throws while importing the root layout. Next surfaces that as `Failed to collect page data for /_not-found` — naming an innocent file and never mentioning environment variables. The preflight fails just as hard, one stage earlier, naming the variable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

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

## Orders — the manual sales workflow

🟡 **The data layer is complete and verified. No screen renders it yet.**

Bondo takes no payment online (**ADR-63**). A shopper fills a basket, leaves a
phone number, and a manager rings back to agree the configuration, the delivery
and the price. `order_status` therefore tracks a **conversation** — `new →
contacted → confirmed → preparing → shipped → delivered`, plus `cancelled`,
which is reachable from anywhere and terminal.

### What exists

| Layer                 | State                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Migration             | ✅ `20260809001000_orders_and_reviews.sql` — 4 tables, 1 enum, 1 sequence, 2 functions, 2 triggers, 10 policies        |
| Generated types       | ✅ `npm run db:types` — 34 tables, `order_status` and `place_order` both present                                       |
| Permissions           | ✅ `orders.read`, `orders.update` in the database **and** mirrored in `lib/admin/permissions.ts` (**ADR-67**)          |
| `services/orders`     | ✅ list, detail, status update, delivery fee, phone-keyed customer history, CSV export rows, status counts, place      |
| `services/reviews`    | ✅ list, summary, reviewable products, eligibility, create, delete                                                     |
| `actions/orders`      | ✅ `placeOrder` (public), `updateOrderStatus`, `updateOrderDetails`, `exportOrders`, `loadCustomerHistory`             |
| `actions/reviews`     | ✅ `submitReview`, `removeReview`                                                                                      |
| Basket                | ✅ `components/cart/cart-provider.tsx` — localStorage, cross-tab, quota-safe (**ADR-64**). **Nothing fills it** (D-30) |
| Screens               | ❌ **none** — checkout, success, admin list, admin detail, review form (**D-31**)                                      |
| Admin module registry | ❌ held back on purpose, so the sidebar cannot link to a 404 — see the comment in `lib/admin/modules.ts`               |

### The three properties worth knowing

**Nothing writes an order directly.** `place_order()` is `security definer` and
no role holds insert on `orders` or `order_items` (**ADR-65**). It takes a basket
and **no prices**; every line is priced from the catalog inside the transaction
that writes the row. A client-supplied total cannot reach a price column.

**The timeline writes itself.** `record_order_status_change` appends to
`order_status_history` inside the same transaction as the update, and the table
carries the append-only guard. A status cannot move without the history
recording it, and no caller — including `service_role` — can rewrite one.

**The review gate is a policy, not a check** (**ADR-66**). Verified buyer,
delivered order, one per purchased product: all three live in an RLS `with
check`, so the rule survives the next action written in a hurry.

### Verified

`npm run verify` passes: 111 schema assertions, then the production build. The
order assertions are behavioural rather than structural — a real order is placed
and then moved:

| Assertion                                                         | Result                                           |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `place_order` issues a readable reference                         | `BND-001000`                                     |
| prices come from the database, not the caller                     | ✅ subtotal 299800 from a caller that sent none  |
| the line snapshots name, SKU and unit price                       | ✅                                               |
| **re-pricing the catalog does not move a placed order**           | ✅ still 299800 after the product went to 999999 |
| the timeline records the order's birth unasked                    | ✅                                               |
| each status move appends exactly one row                          | ✅                                               |
| re-saving the same status appends nothing                         | ✅                                               |
| the timeline is append-only                                       | ✅                                               |
| a delivery fee that does not reach the total is rejected          | ✅                                               |
| an order with no lines is refused                                 | ✅                                               |
| an unpublished product cannot be ordered                          | ✅                                               |
| **a review is refused while the order is not delivered**          | ✅ under `set role authenticated`                |
| **a delivered buyer may review what they bought**                 | ✅                                               |
| one review per buyer per product                                  | ✅                                               |
| somebody else's order earns nobody a review                       | ✅                                               |
| a delivered order earns no review of something it did not contain | ✅                                               |
| a customer reads their own order under RLS                        | ✅                                               |

The four review rows run with RLS enforced and a real JWT claim, not around it.

> **Not verified:** nothing has run against the hosted project. The migration is
> committed but **not pushed** — `supabase db push` needs credentials this
> session did not have. Until it runs, `pgxqnezwrwfgrmamlxhs` has 30 tables and
> the committed types describe 34.

---

## Responsive UI (Phase 3E)

🟡 **Two defects found by measurement and fixed. The audit itself is barely
started.**

Both fixes were measured in a browser before and after, not reasoned about:

| Defect                     | Before                | After            |
| -------------------------- | --------------------- | ---------------- |
| Horizontal scroll at 320px | 35px of overflow      | **0**            |
| Footer height at 320px     | 1062px (1.33 screens) | **543px (0.75)** |
| Footer link touch target   | ~20px                 | 44px             |

**The overflow was a `min-width: auto` trap.** A CSS grid item will not shrink
below its content's min-content width, and `truncate` sets that to the full
string because of `white-space: nowrap`. The reviews card measured 339px inside a
288px column. `min-w-0` on the item fixes it, and the same trap is latent in any
grid whose cards contain a truncating line.

**The footer collapses with `<details>`, not Radix** — the footer is on every
page, and the Accordion primitive is a Client Component. `<details>` needs no
JavaScript, no ARIA and no hydration. It cannot be forced open by CSS at a
breakpoint, so the groups render twice with the link list shared; the trade is
argued at the component.

### Not done — most of the brief

Stated plainly because the request was much larger than what was delivered:

- **The "freezes when buttons are pressed" report was not investigated.** No
  latency was measured. The cause is unknown and nothing was changed for it.
- **The breakpoint sweep covered 320px and one desktop width, on the home page
  only.** Eight of the ten widths, and every route other than the home page,
  are unaudited.
- **The header was measured (65px) and not changed.**
- **17 tap targets under 40px** were found — mostly the header's 32×32 icon
  buttons — and not fixed.
- **No Client Component was removed.** 74 files still carry `"use client"`.
- **First Load JS is unchanged**: 143 kB home, 103 kB shared, 104 kB middleware.

Tracked as Phase 3E in [ROADMAP.md](ROADMAP.md#phase-3e--responsive-ui--performance).

---

## Simplifying for v1

🟡 **Two of the brief's five parts are done. Three are not, and are listed below
rather than implied.**

### Done

**The category taxonomy is real and in the database.**
`20260810001000_default_categories.sql` inserts the twenty categories the
business sells, in uz/ru/en, with a slug per locale. A migration rather than
`seed.sql`, because `seed.sql` never runs on `db push` and reference data a
deployment cannot function without has to ship with the schema (**ADR-68**).
Idempotent; flat, because that is the list given; nestable from the admin
because `parent_id` and the `path` trigger have worked since Phase 2.

Six assertions cover it: twenty rows, all three languages each, the written
names, SSD untranslated, per-locale slugs distinct, and the tree still nesting.

**The storefront has no invented data left.** The home page's three fixture
reviews are gone and it reads `product_reviews`; twelve mock ratings are zeroed;
the `low-stock` badge is deleted. `Review` now matches the schema — plain
strings, no `LocalizedText`, no `verified` flag, because RLS already guarantees
every review is a verified purchase.

**The admin dashboard shows only real numbers.** Every figure now comes from a
query or is absent:

| Widget                            | Now                                                           |
| --------------------------------- | ------------------------------------------------------------- |
| Waiting on a call                 | `orders` at `new` — real                                      |
| Orders                            | `orders` count — real                                         |
| Revenue                           | sum of **delivered** orders — real (ADR-63: cash at the door) |
| Products                          | `products` count — real                                       |
| Latest orders                     | `listOrders`, 7 rows — real                                   |
| Recent activity                   | `audit_logs` — real                                           |
| Revenue + orders charts           | **deleted** — nothing records a 30-day series                 |
| Customers                         | **deleted** — counted mocks, and most orders are guests       |
| Units on hand, low stock          | **deleted** — this shop does not track stock                  |
| Pending reviews                   | **deleted** — hardcoded zero, and no moderation queue         |
| "Figures are illustrative" banner | **deleted** — they no longer are                              |

The notification bell and the command palette's customer and order groups were
fed from `mocks/admin.ts` too. The bell is now empty — nothing in the schema
produces a notification, so there is nothing to list — and the palette no longer
answers a search for a customer, because answering confidently and wrongly is
worse than not covering a resource yet.

Each widget degrades independently: a read that fails logs at `error` and costs
that panel, not the page. That matters here because the orders migration has not
been pushed to the hosted project.

**A live bug fell out of this.** `adminDashboard.orderStatus` still held the old
payment vocabulary — `pending`, `paid`, `fulfilled`, `refunded` — while
`OrderStatus` became `new … delivered` two changes ago. Every order badge would
have rendered a raw key. The translation checker cannot catch it: it compares
locales against each other, and the key was equally wrong in all three.

### Not done

- **Inventory management is still in the admin.** The module, its route, its
  screens and `adminInventory` in all three locales are untouched. Removing it
  touches the module registry, the quick actions, the dashboard's low-stock
  widget, the command palette and three message files — more interlocking edits
  than there was budget for, and a half-removed module is worse than an intact
  one.
- **Product management was not changed.** The editor still carries stock fields
  and still renders mock shapes (**D-29**).

`inventory` and `inventory_movements` stay in the schema regardless. Dropping an
append-only ledger to simplify an interface would be destroying data to hide a
screen; hiding the screen is a UI decision, and the tables cost nothing while
nothing writes them.

---

## Next task

**Push the orders migration, then build the screens over it.**

1. **`supabase db push`.** The migration is committed and applies cleanly to
   PGlite; the hosted project has not seen it. Nothing that reads `orders` will
   work until it has, and `types/database.ts` already describes the post-push
   schema.
2. **The checkout slice** — `CartProvider` into `app/[locale]/layout.tsx`, an
   add-to-basket control on the product card and detail page, `/checkout` over
   `placeOrder`, and `/checkout/success` reading the reference from the query
   string. It reads it rather than fetching, because a guest holds no privilege
   on their own order — that is a schema fact, not a shortcut (**D-30**).
3. **The admin module** — `app/[locale]/admin/orders/` list and detail, then put
   the registry entry back. The comment in `lib/admin/modules.ts` says exactly
   what it contains (**D-31**).
4. **The review form** on the product page, over `listReviewableProducts` and
   `submitReview`.

Then, still outstanding from before:

**Configure a real SMTP provider (K-21), then populate the catalog.**

1. **SMTP.** Every account flow sends mail, and the project is on Supabase's
   built-in mailer — a handful of messages an hour, explicitly not for
   production. It is already the reason a live registration failed at the mail
   step during verification. Project → Settings → Auth → SMTP.
2. **Re-run the bootstrap with a real address.** The current administrator is
   `owner@bondo.test`, which cannot receive mail, so it can never reset its own
   password: `npm run admin:bootstrap -- --email you@real-domain.com --force`.
3. **Populate the catalog.** Unchanged from before and still a product
   decision: real products through the admin once it persists, or `seed.sql`
   pushed deliberately as a staging fixture (ADR-25).

Then Phase 6's admin persistence: Server Actions behind each admin form and
the deletion of `mocks/admin.ts` (**D-15**, **D-16**). The panel is now gated by
a real role check, so writes have somebody to attribute.

---

## Next phase

**Finish Phase 3B**, then Phase 4 — Cart & Checkout. See
[ROADMAP.md](ROADMAP.md#phase-3b--storefront-data-wiring).

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
