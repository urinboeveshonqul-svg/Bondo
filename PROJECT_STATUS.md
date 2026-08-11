# Project Status

> **This file is the single source of truth for where the project stands.**
> It is updated at the end of every completed task. If this file and the code
> disagree, the code is right and this file is a bug — fix it immediately.

**Last updated:** 2026-08-09
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
| Schema assertions (`db:verify`)        | **175**, up from 173                                                                                               |
| Translations                           | **14 namespaces × 3 locales, 747 keys each**                                                                       |
| First Load JS — home                   | **143 kB**                                                                                                         |
| First Load JS — listing / detail       | 120 kB / 131 kB                                                                                                    |
| First Load JS — admin dashboard        | 134 kB                                                                                                             |
| First Load JS — admin, heaviest        | 195 kB (brands: table + dialog editor)                                                                             |
| Shared JS                              | 103 kB                                                                                                             |
| Middleware bundle                      | **105 kB**                                                                                                         |
| Static prerendered routes              | **94**                                                                                                             |
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
| Migrations applied  | 🟢 **all 23**, local and remote in lockstep                                    |
| Schema drift        | 🟢 none — `db:types:remote` structurally identical to the committed file       |
| Tables              | 36, all with RLS enabled and explicit policies                                 |
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

| #    | Issue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Severity                                                                                                                                | Plan                                                                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K-24 | ~~`redirectTo` is double-prefixed with the locale after sign-in.~~ **Closed.** Middleware wrote `redirectTo=/uz/account` while every consumer treats the value as unprefixed — `signInAction` hands it to `router.push()` from `@/i18n/navigation`, which prefixes whatever it is given, so the visitor landed on `/uz/uz/account`. Sign-in itself succeeded, which is why it read as a broken link rather than a broken login. `supabase/session.ts` now stores the path from `splitLocale()`, matching `lib/routes.ts` and `lib/auth/guards.ts`, which were already unprefixed. Verified in a browser: the footer account link → sign-in → **`/uz/account`**, and the sign-in page still renders in the language the visitor was reading.               | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-23 | **`listRecentReviews` fails against the hosted project on every home-page render.** Logged as `[catalog] recent reviews unavailable — Could not load the reviews.` The section degrades to empty by design, so nothing is visibly broken, which is exactly why it went unnoticed. Seen repeatedly in the dev server log while verifying the category work; the underlying Postgres error was not captured, so the cause is **unknown** — most likely the `product_reviews` embed or its RLS policy against the live schema.                                                                                                                                                                                                                               | Low today, medium once reviews exist — a rail nobody can see is a feature nobody knows is broken                                        | Capture the Postgres code from `toAppError`'s cause and run the same select through the anon key, as the category verification script did                                                                                                                                                                                      |
| K-18 | ~~Every route returned 500 in production.~~ **Fixed.** `app/[locale]/layout.tsx` awaited `listCategories()` for the header menu. A layout renders on every route beneath it and **its own `error.tsx` cannot catch it** — `app/[locale]/error.tsx` renders _inside_ that layout — so one unreachable query escalated to `app/global-error.tsx` and replaced the whole document, on every URL including the 404. Reproduced against `next start`; fixed with `listNavigationCategories()`, which degrades to an empty menu and logs the failure.                                                                                                                                                                                                           | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-19 | **An exception thrown while rendering a Server Component page does not reach `app/[locale]/error.tsx`.** It aborts the shell before it flushes, so Next serves `app/global-error.tsx` — unbranded, unlocalized, whole document. Proven by probe: a bare `throw new Error()` at the top of the home page produced `<html id="__next_error__">`, never the route boundary. A Suspense boundary above the throw changes the outcome and makes it worse — `products/loading.tsx` flushed a skeleton and answered **200** with no content, the soft-error ADR-41 exists to prevent. Mitigated rather than removed: storefront pages read through `readCatalog()` and render `CatalogUnavailable` instead of throwing.                                          | Medium — it applies to any page that throws, not only catalog reads                                                                     | A page that must fail with a real 5xx needs its own answer. The constraint is documented at `readCatalog()` so the next author meets it before the outage does                                                                                                                                                                 |
| K-20 | ~~**The localized 404 does not render in production.**~~ **Resolved by ADR-82**, with one residual below. A URL that matches no route — the overwhelming majority of 404s — now answers 404 with a complete localized document: `<html lang>` correct per locale, the translated copy, the stylesheet and the font. Verified on a production build in all three languages and in a browser.                                                                                                                                                                                                                                                                                                                                                               | Resolved                                                                                                                                | Residual, tracked as **K-25**: a `notFound()` from a route that _did_ match still streams Next's bare shell first                                                                                                                                                                                                              |
| K-25 | **A matched route's `notFound()` streams the framework shell before the real document.** `/{locale}/products/<unknown-slug>` answers 404 and renders correctly in a browser — `lang` right, copy right, header and footer present, verified in all three locales — because the correct document arrives in the RSC payload and React reconciles to it. The _initial_ HTML is still `<html id="__next_error__">`. A client that never executes JavaScript therefore sees the right copy with no `lang` and no styling. The same applies to a path with a file extension (`/nothing.txt`), which the middleware matcher deliberately skips, so it reaches `[locale]` as a locale and the layout's `notFound()` fires from a layout.                         | Low — the status is correct, the page is correct in any real browser, and a 404 is `noindex` so no crawler is being told anything wrong | Next.js applies no layout to a matched route's not-found boundary; there is no configuration for it. Revisit on a Next upgrade. Not worth a workaround: the two candidates were an inline script rewriting `documentElement.lang` and `dynamicParams = false`, and the second would 404 every new product until the next build |
| K-1  | ~~`/admin` is protected by authentication only.~~ **Closed.** `requireAdmin()` in the admin layout reads the `admins` register and the role graph; `isAdminPreview` and the `NODE_ENV` gate (ADR-45) are deleted. Verified with real session cookies: a signed-in customer gets **404** at `/admin` and at a deep admin route, the bootstrapped administrator gets 200. RLS remains the boundary (ADR-4).                                                                                                                                                                                                                                                                                                                                                 | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-2  | ~~The sign-in page does not exist, so protected routes 404 after the redirect.~~ **Closed.** Sign-in, sign-up, forgot-password, reset-password and verify-email all exist and render in three locales; the redirect carries `redirectTo` and lands in the visitor's language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-16 | ~~The admin's vocabulary diverges from the schema's enums.~~ **Closed.** `ProductStatus` and `MovementReason` now derive from `Enums<"…">`; `product_visibility` became the separate control the schema always had; the interface no longer offers `published`, `damage` or `recount`, none of which the database accepts. `npm run enums:check` fails the build on any recurrence.                                                                                                                                                                                                                                                                                                                                                                       | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-15 | ~~The schema cannot store the application's content model.~~ **Closed.** Migration `20260804001000_localization.sql` adds six normalized translation tables keyed `(entity, locale)`, a `public.locale` enum, per-locale `search_vector` columns and per-locale unique slugs. The single-language columns were migrated to `en` and **dropped**, so there is one place to write a name (**ADR-51**).                                                                                                                                                                                                                                                                                                                                                      | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-3  | ~~`types/database.ts` is stale.~~ **Closed.** Generated from the 9 migrations by `@supabase/postgres-meta` — the generator the Supabase CLI runs in its container — introspecting PGlite over the Postgres wire protocol (**ADR-48**). 18 tables, 970 lines, no Docker required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Resolved                                                                                                                                | Re-run `db:types:remote` once a project is linked and treat any diff as schema drift.                                                                                                                                                                                                                                          |
| K-22 | ~~A user who had ever written an audit entry could never be deleted.~~ **Closed.** `audit_logs.actor_id` was `on delete set null` while the table carries a `before update or delete` append-only guard (ADR-27) — the cascade tried to UPDATE the audit row, the guard raised, and the whole `DELETE FROM auth.users` rolled back. It surfaced as an opaque GoTrue `500` with an empty body, naming neither the constraint nor the table. Every administrator writes audit entries by definition, so the entire staff register was undeletable. Fixed by `20260807001000_audit_log_independence.sql`: the foreign key is dropped rather than the guard weakened, so the log outlives its actors and keeps `actor_id` **and** `actor_email` (**ADR-61**). | Resolved                                                                                                                                | —                                                                                                                                                                                                                                                                                                                              |
| K-21 | **Transactional email is Supabase's built-in mailer**, which is rate-limited to a handful of messages per hour and explicitly not for production. Measured: a registration was accepted and then failed at the mail step with `email rate limit exceeded`. Every flow that sends — confirmation, resend, password reset — is throttled by it, and under exhaustion the reset endpoint briefly became an enumeration oracle before that was closed (ADR-60).                                                                                                                                                                                                                                                                                               | **High — it gates launch, and it is invisible until a real user cannot register**                                                       | Configure a real SMTP provider in Project → Settings → Auth before any public traffic                                                                                                                                                                                                                                          |
| K-8  | **Buckets verified, policies still unproven.** All five buckets exist on the hosted project with the intended configuration — `products` 10 MB, `brands` 2 MB, `avatars` **private** 2 MB, `banners` 10 MB, `site-assets` 5 MB, each with its MIME allow-list. But `storage.objects` RLS is still unexercised: an anonymous list of the private `avatars` bucket returned `200 []`, which is what a _correct_ policy and a _broken_ one both return while the bucket is empty. Avatar folder scoping remains unproven.                                                                                                                                                                                                                                    | Medium                                                                                                                                  | Upload one object under `avatars/<user-id>/` and confirm a second user cannot read it                                                                                                                                                                                                                                          |
| K-9  | The seed's `auth.users` / `auth.identities` inserts follow the documented Supabase shape but were never run against real GoTrue. If the column set has drifted, `db:reset` fails on the seed — noisily, and only locally.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Low                                                                                                                                     | First real `npm run db:reset`                                                                                                                                                                                                                                                                                                  |
| K-10 | Trigram search (`sku % 'text'`) resolves only because Supabase puts `extensions` on the role search_path. A service that schema-qualifies nothing will break if that default changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Low                                                                                                                                     | Phase 3 — schema-qualify or use `extensions.similarity()`                                                                                                                                                                                                                                                                      |
| K-14 | **`next.config.ts`'s env preflight does not protect the Edge runtime.** The middleware is a standalone bundle; `next.config.ts` never executes there. A `NEXT_PUBLIC_*` variable that is _unset at build_ is not inlined and stays a runtime `process.env` read, so its runtime value was never validated by anything. Currently harmless — after ADR-35 the middleware reads only the two variables that **are** inlined — but it re-arms the moment anything in that chain reads a non-inlined variable.                                                                                                                                                                                                                                                | Medium (latent)                                                                                                                         | Phase 9, alongside CI                                                                                                                                                                                                                                                                                                          |
| K-13 | ADR-34 (relative imports throughout the middleware chain) is enforced by a comment in two files and nothing else. Adding one `@/` import anywhere reachable from `middleware.ts` — including deep in a future service — breaks deployment with an error that names neither the rule nor the file that introduced it. A ~40-line script walked the graph and confirmed it is clean; it is not committed.                                                                                                                                                                                                                                                                                                                                                   | Medium — the chain grows with every phase                                                                                               | Commit the graph check and wire it into `npm run check`; natural fit with CI in Phase 9                                                                                                                                                                                                                                        |
| K-12 | The production build is pinned to webpack because Vercel's Edge bundler cannot consume Turbopack's middleware output (ADR-33). Turbopack builds are the direction of travel, so this should be retested on future Next.js releases rather than assumed permanent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Low                                                                                                                                     | Retest each Next minor; revisit in Phase 9                                                                                                                                                                                                                                                                                     |
| K-11 | A `/** … */` JSDoc block **inside** the exported `config` object in `middleware.ts` breaks Vercel deploys with `Unhandled type: "ColonToken" :`. `@vercel/static-config` destructures a property's children positionally and JSDoc adds one. Fixed, and the constraint is documented at the site — but nothing mechanically prevents reintroducing it, and the error names neither the file nor the comment.                                                                                                                                                                                                                                                                                                                                              | Low (fixed, can regress)                                                                                                                | Would need a lint rule; revisit in Phase 9 with CI                                                                                                                                                                                                                                                                             |
| K-4  | No Content-Security-Policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Medium                                                                                                                                  | Phase 4                                                                                                                                                                                                                                                                                                                        |
| K-5  | Middleware bundle is 162 kB (`@supabase/ssr` + `supabase-js`). Signed-in users pay Edge cold-start cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Low                                                                                                                                     | Monitor                                                                                                                                                                                                                                                                                                                        |
| K-6  | `allowScripts` in `package.json` is npm 11 syntax. A CI runner on npm 10 will not build `sharp`'s native binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Low                                                                                                                                     | Phase 9                                                                                                                                                                                                                                                                                                                        |
| K-7  | Header placeholder controls are `disabled`, so keyboard users find only the logo interactive in the header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Low                                                                                                                                     | Phase 3                                                                                                                                                                                                                                                                                                                        |

---

## Technical debt

| #    | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Interest rate                                                                                                                                                                        | Pay down                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-34 | **Product variants have a schema, a verified service and no Server Actions.** `product_variants`, `product_options` and `services/variants.service.ts` all exist and are asserted by `db:verify`; nothing writes them. The product editor rendered a variant editor that saved nothing, and it was removed this pass rather than left showing a form whose Save is a lie.                                                                                                                                                                                                                                     | Medium — a data layer nobody writes is one whose shapes stay unproven                                                                                                                | Actions over `variants.service`, then the section returns to the editor                                                                          |
| D-33 | **Specification values are not localized.** `product_specifications.value` is one `text` column, so "Linear mechanical" cannot be written in three languages — only identifiers and measurements ("GDDR6X", "3840 x 2160") are safe in it. The editor writes free text, which is what the column holds; a form pretending otherwise would collect copy with nowhere to go.                                                                                                                                                                                                                                    | Low — most spec values genuinely are language-independent                                                                                                                            | A `product_specification_translations` table, if a real product ever needs prose specs                                                           |
| D-32 | **The admin category list takes ~7s to reflect a write in the dev server.** Measured twice, both directions, by polling the row's own control until its label flipped. The write itself is immediate — the database was read back to confirm it — so this is `router.refresh()` re-rendering a 102-row tree under Turbopack with `revalidatePath('/<locale>', 'layout')` invalidating the whole locale subtree. **Not re-measured against a production build**, where both the recompile and the revalidation cost are different. If it survives, the fix is a narrower revalidation than the whole layout.   | Low — it is latency on a screen an operator uses occasionally, not a wrong answer                                                                                                    | Re-measure against `next start`; narrow `revalidateCatalog()` if it holds                                                                        |
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
| D-29 | ~~The product editor still renders `mocks/admin.ts` shapes.~~ **Paid.** The editor is bound to `AdminProductDraft`, every field of which is a column; `saveProduct` writes it, and the list, the images and the specifications all persist. Verified live (61/61) and driven in a browser. Variants came out and are tracked separately as **D-34**.                                                                                                                                                                                                                                                          | Resolved                                                                                                                                                                             | —                                                                                                                                                |
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
| D-16 | ~~The admin is entirely non-persistent.~~ **Largely paid.** Products, categories, brands and highlights all write through `createAction()` → service → Supabase → RLS, and every form reports the database's answer rather than a toast. The five fixture modules above are what is left.                                                                                                                                                                                                                                                                                                                     | Low — down from Medium                                                                                                                                                               | With the remaining five modules                                                                                                                  |
| D-15 | ~~`mocks/admin.ts` still backs **inventory, homepage, content pages, users and settings**.~~ **Resolved.** All five persist to Supabase, verified by 94 live CRUD checks against the linked project, and the file is deleted — it had no importers left.                                                                                                                                                                                                                                                                                                                                                      | Resolved                                                                                                                                                                             | —                                                                                                                                                |
| D-31 | **The team screen cannot show email addresses.** `auth.users` is not exposed through PostgREST and no RLS policy can grant it, so an address could only be read with the service role — reading a staff list with privileges the operator does not hold, which is the bypass ADR-4 exists to prevent. Administrators are identified by name and job title.                                                                                                                                                                                                                                                    | Low — an operator who needs an address asks the person                                                                                                                               | A `profiles.email` column synchronised by a trigger on `auth.users`, if the need becomes real. Not speculatively                                 |
| D-14 | **The copy has no native review.** The Uzbek and Russian are written rather than machine-translated, and `npm run copy:check` now fails the build on the mechanical tells — detached case suffixes, leaked infrastructure vocabulary, transliterated technical names. What it cannot judge is **register**: whether a sentence sounds like a person who sells computers in Tashkent. That needs a native speaker, and no automated check will replace one.                                                                                                                                                    | Medium — every new string compounds it, and wrong register is invisible to whoever wrote it                                                                                          | A native reviewer before any public launch. The strings are isolated in `messages/` and on catalog records, so a review is a self-contained pass |
| D-13 | No client-side behaviour has been driven against a real browser. The theme toggle, basket and wishlist sheets and mobile nav are verified only by typecheck, build and server markup. The preview pane injects the document via `innerHTML`, so the streamed inline scripts never run and the app never hydrates in it.                                                                                                                                                                                                                                                                                       | Medium — every added interaction widens the gap                                                                                                                                      | Phase 9's test suite; sooner if a real browser becomes available                                                                                 |

---

## Architectural decisions

Decisions with lasting consequences. **Do not reverse one without recording the
reversal here.**

| ID     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-84 | **Every admin module persists, and a module that cannot is removed rather than faked.** Inventory, content pages, banners, team and settings now run UI → Server Action → Zod → `requirePermission` → service → Supabase → RLS → `revalidatePath`. The homepage _section_ editor and five settings tabs are deleted, not migrated. `mocks/admin.ts` is deleted.                                                                                                                | The five modules shared one failure: a full form whose submit raised `notSaved()`. Two ways out existed for the parts with no table — invent the schema, or remove the control — and they are not equivalent. Banners had a table, RLS and translations already, so wiring them was the whole job. Homepage _sections_ had none, and the home page does not compose itself that way (ADR-75), so a `homepage_sections` table would have been read by nothing: a fixture with a migration attached, harder to notice as fake than the fixture was. The settings form is the same judgement at field level — it offered a tax rate, sender addresses, four social URLs and a per-day hours grid over keys that do not exist, and now edits the ten keys that do, each with a live reader. Removing controls made the panel smaller and made every remaining control true, which is the trade ADR-20 already commits this codebase to.                                                                                                                                                |
| ADR-83 | **Mobile is the primary target, and touch sizing is set once in the primitives.** The Button `icon` variant, `Input`, the auth submit, the sheet close and the category chips are 44px on touch and return to their compact size from `lg`. A department with more than six sections replaces its mobile scroller with `SubcategorySheet`. The mobile header carries four actions — menu, search, account, basket — and language, theme and wishlist move into the menu panel. | Measured on a production build at 390px, not assumed. The header had **five 32px icon buttons** crowded against the logo and no way to search without opening the menu first; the listing toolbar rendered its count, filter and sort on one line, which forced all three to `size="sm"` — **28px**; and a department like Aksessuarlar stacked a **1825px** section scroller directly under the departments' own **1682px** one, 138px of navigation before any product. Fixing the sizes in the primitives rather than per call site matters for a reason found the hard way: an override lands on the same element as the variant's own `size-8`, and which one wins depends on stylesheet order rather than on intent. Desktop keeps every density it had — the `lg` branch is the old value in each case, verified unchanged at 1024px and 1440px.                                                                                                                                                                                                                            |
| ADR-82 | **The 404 owns its document, and it takes two files to do it.** `app/layout.tsx` renders `<html>` and `<body>` (locale from `getLocale()`, not `params`); `app/global-not-found.tsx` — enabled by `experimental.globalNotFound` — renders a complete document for URLs that match no route; both share `components/shared/not-found-document.tsx`. `app/[locale]/[...rest]/page.tsx` is deleted. **Supersedes ADR-42.**                                                        | K-20, measured on production builds rather than reasoned about. Next.js renders a 404 against the **root** layout and nothing below it, so with a passthrough root there was no `<html>` to render into and Next substituted its own shell: `<html id="__next_error__">`, no `lang`, no stylesheet, no font. The localized copy rendered perfectly _inside a document that looked like a crash_. Moving the document up alone did not fix it — an unmatched URL gets no layout at all, which is what `global-not-found` exists for — and `global-not-found` alone did not either, because the `[...rest]` catch-all made every unmatched URL a _matched_ one and sent it back to the built-in boundary. Removing the catch-all is what let the two halves meet. The locale comes from `getLocale()` because `cookies()`/`headers()` throw where this renders, and next-intl's resolver falls back to the default instead. The chrome deliberately stays in the locale layout: a 404 that needs the category query is a 404 that can fail (**K-18**).                               |
| ADR-81 | **A missing product is a 404, and that needs two things: the read returns `null`, and no Suspense boundary sits above the route.** `catalog.reads.getProductBySlug` converts the service's `not_found` into `null`; `products/loading.tsx` moved into a `(listing)` route group so it stops wrapping `products/[slug]`.                                                                                                                                                        | Both were load-bearing, and each was measured on a production build. With the read throwing, `readCatalog` caught the `AppError` and rendered `CatalogUnavailable` — so `notFound()` never ran and the page answered **200** claiming the catalog was broken, when the truth was that the product did not exist. With that fixed but the boundary still in place, `notFound()` ran and the status was **still 200**, because the shell had already flushed — ADR-41's mechanism exactly, re-confirmed by putting the file back and watching it regress. The route group is the structural fix rather than a second `dynamicParams` guard: it is URL-transparent, so `/products` is unchanged, the listing keeps its skeleton, and `[slug]` is simply outside the boundary.                                                                                                                                                                                                                                                                                                         |
| ADR-80 | **A module declares whether it persists, and the "partly connected" banner is derived from that.** `persistence: "live" \| "read-only" \| "fixtures"` on every registry record; the shell lists the fixture ones and renders nothing when there are none.                                                                                                                                                                                                                      | The banner was a hand-written sentence naming brands as the only connected module. It had to be edited every time one landed, was wrong in between, and told an operator nothing about the screen they were actually on. Deriving it means the claim cannot drift from the code, it names only modules the reader can open, and it disappears by itself when the last one is wired. The three-way value matters: an audit log nobody can edit is real data, which is a different promise from a Save that does nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-79 | **A filter exists only where a column backs it.** The listing offers price, brand and on-sale. It does **not** offer availability or specification facets.                                                                                                                                                                                                                                                                                                                     | `inventory` exists but this shop does not maintain stock levels — the low-stock badge was removed for that reason — so an "in stock" checkbox would filter on a number nobody updates, and it would look authoritative while doing it. `product_specifications` is free-text key/value, so faceting it means guessing which keys are worth offering and rendering whatever an editor typed. Sorting is held to the same rule: there is no "by name", because a product's name lives on a to-many translation row that PostgREST cannot order a parent by, and a sort control that changes the URL without changing the order is worse than an absent one. Each returns the day the data does.                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-78 | **The catalog listing's state is the URL, and the page stays a Server Component.** `lib/catalog/search-params.ts` is the only module that knows the query-string encoding; `CatalogFilters` and `CatalogToolbar` are the sole client islands.                                                                                                                                                                                                                                  | A filter panel built on `useState` re-renders instantly and loses everything else: the result is not shareable, not bookmarkable, does not survive a reload, breaks the back button, and forces the whole listing into a Client Component to hold the state. Routing every control through one encoder also means the brand checkbox, the removal chip and the "clear" link cannot disagree about how a filter is spelled — they call the same functions. The cost is a round trip per filter change, which is a Server Component render rather than a page load, and is the trade this codebase already makes everywhere else.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-77 | **A page whose copy nobody has approved is not created.** Privacy, terms, "build service" and "business accounts" have no `content_pages` row and no footer link; the returns page exists and states that the policy is not finalised.                                                                                                                                                                                                                                         | Every one of them was requested. The difference is that delivery, warranty and about have _facts_ behind them — carriers, a 24-hour window, a one-year term — while a privacy policy and a returns window are legal commitments, and writing plausible ones would bind the business to terms nobody agreed. A missing page is visibly missing and costs a link; an invented policy is invisible until somebody relies on it. Returns is the interesting case and is the pattern for the rest: the page exists because customers need somewhere to land, and it says what is true — talk to us — rather than inventing a window. Each becomes a link with one row in `content_pages` and one line in `SUPPORT_LINKS`.                                                                                                                                                                                                                                                                                                                                                               |
| ADR-76 | **Content page bodies are plain text in a three-rule syntax** — `## ` heading, `- ` list item, blank line between paragraphs — parsed by `components/content/content-body.tsx`. Not HTML, not Markdown, not JSON.                                                                                                                                                                                                                                                              | HTML in the column is the flexible answer and means rendering database markup through `dangerouslySetInnerHTML`; the write path is permission-gated and RLS-protected, so it is not an open door, but "an editor account can inject script into every visitor's page" is a poor trade for formatting a warranty page. Markdown needs a parser _and_ a sanitiser — two server-bundle dependencies to support three block types out of forty. A JSON block structure would be more expressive and would turn the admin editor into a form nobody can type prose into. Plain text is what an operator can read and edit in a textarea, and anything the parser does not recognise renders as a paragraph — so unexpected input becomes visible text rather than markup or silence.                                                                                                                                                                                                                                                                                                    |
| ADR-75 | **The landing page and the listing filter are built from the navigation _tree_, capped, and skip anything empty.** Home shows at most 6 department rails and only those with products; the listing offers the 12 departments plus one level of narrower filters, never the whole taxonomy.                                                                                                                                                                                     | Both rendered one element per category, which was survivable at twenty and became absurd at 102: the home page emitted **102 sections and a 54,246px document**, and the listing put a **424px** strip of 102 filter chips above results that were often empty. Both also cost a query per element — the home page fired a product query per rail. Deriving from the tree fixes the count and the query volume together, because the top level is twelve things and `productCount` is already the rolled-up subtree total, so an empty department is skipped without asking the database anything. The caps are layout decisions and are stated as such: **which** departments appear is `display_order`, which an operator sets in `/admin/categories`, so nothing here names a category (§ 12).                                                                                                                                                                                                                                                                                  |
| ADR-74 | **Filtering by a department means filtering by its whole subtree.** `catalog.reads.listProducts` resolves the selected category to every id whose `path` contains it and passes `categoryIds`; `products.service` filters with `in`.                                                                                                                                                                                                                                           | Products are filed against a leaf — a graphics card is in Graphics cards, never in Components — so `category_id = <Components>` matches nothing, and all twelve department links would render an empty shop. `path` is the trigger-maintained root-to-self chain (ADR-26), so the subtree is a containment test on an array the caller has already fetched for the menu: no recursive query, no second round trip, and correct at any depth. Resolved in the read facade rather than the service because the service must stay callable with an explicit id — an import script filing into one leaf should not silently match a subtree.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-73 | **The mega menu is one trigger over a two-pane panel, not twelve header triggers.** Departments run down the left; the hovered one's subcategories fill the right.                                                                                                                                                                                                                                                                                                             | The brief asks for a hover on each top-level category, and that is what was built first. It was then **measured**: twelve department labels put `document.scrollWidth` at 2423px inside a 1280px viewport — the whole desktop page scrolled sideways before any content rendered. The two ways out were shortening the department names, which means naming them for the layout instead of for the shopper, or moving the hover inside the panel. The second keeps every name and every behaviour the brief describes, and is what large computer retailers do for the same reason. Every panel stays in the DOM as `hidden` rather than being mounted on demand, so the server HTML carries all 102 category links.                                                                                                                                                                                                                                                                                                                                                               |
| ADR-72 | **Supersedes ADR-68.** The default taxonomy is a **tree** — 12 departments and 90 subcategories in uz/ru/en, with a slug and SEO copy per locale — and `categories` gains `icon` and `is_featured`. Still a migration, not `seed.sql`.                                                                                                                                                                                                                                         | ADR-68's reasoning is unchanged and is not being reversed: a category tree is the shop's own reference data, `seed.sql` never runs on `db push` (ADR-25), so a fresh deployment must get its taxonomy from a migration. What changed is the shape. ADR-68 inserted the list flat because that was the list the business gave, and said explicitly that an operator could nest it from the admin; the business has now given the hierarchy, so it ships as one. The old twenty are **removed rather than re-parented**, because several change meaning in the new tree (`Sovutish tizimlari` splits into CPU coolers and case fans) and a database holding half of each design is one nobody can describe. The removal is guarded three ways — untouched Uzbek slug, no products, no children — so an operator who renamed or used one keeps it, and the tree is inserted alongside whatever survived. `icon` follows ADR-69 exactly: a lucide name as text, shape checked by a constraint, membership checked by the Server Action against the same map the storefront draws from. |
| ADR-71 | **A verified email is a second, weaker ownership path — never a replacement for the claim token, and never the same thing as matching a phone number.** `claim_orders_by_email()` attaches unowned orders whose `email` equals the caller's **confirmed** address.                                                                                                                                                                                                             | ADR-70 refused phone matching because a phone number is not a secret. A verified email is different in kind, not degree: Supabase has proven the caller opened mail sent to that mailbox, and the guest chose that address at checkout, so two independent facts line up. It is still weaker than a capability the browser was issued — the address is typed, not granted — so the token is tried first and this only sweeps what is left. The whole security of the path is `email_confirmed_at is not null`, read at call time rather than taken from a JWT issued earlier; without it anybody could register with any address and take the orders under it. The column is optional and must stay optional: a checkout that demands an email to enable a convenience has traded orders for tidiness.                                                                                                                                                                                                                                                                             |
| ADR-70 | **A guest order is claimed with a single-use capability token in an httpOnly cookie — never by matching the phone number, the email or the order reference.** `place_order()` issues `claim_token` for guest orders only; `claim_orders()` moves ownership and spends the token.                                                                                                                                                                                               | Phone matching is the obvious implementation and it is a data-disclosure hole: a phone number is not a secret, so anybody who knows a customer's could register with it and read that customer's name, delivery address, basket and totals. The reference is worse — it is sequential by design so a manager can read it down the phone, so one reference implies a thousand others. A claim therefore needs proof that the claimant is the person who placed the order, and the only party holding that proof is the browser that placed it. The token is random, returned only to the placing caller, kept httpOnly so no script can read it, never put in a URL or a response body, spent on use, and refused against an order that already has an owner. The cost is that clearing cookies loses the automatic link — which fails in the safe direction: the customer still has the order and support can attach it by hand, where phone matching fails silently in favour of whoever guessed a number.                                                                        |
| ADR-69 | **A service highlight's icon is a lucide _name_ stored as text, validated against the component's own map — not an upload, and not a database enum.**                                                                                                                                                                                                                                                                                                                          | Three options and each fails differently. An upload lets an operator put a 900 kB PNG above the fold and makes the trust row an asset-management problem; the glyphs are already in the design system. A database enum makes adding one a migration, for a change that is purely presentational. Free text with no validation renders a hole when somebody types `Sheild`. So: the check constraint enforces the _shape_ of an identifier (rejecting markup and paths), the Server Action enforces _membership_ against `HIGHLIGHT_ICONS`, and the component falls back to a neutral glyph for a name that predates a rename. One list drives the picker and the storefront, so the two cannot drift, and extending the set is a change to one file.                                                                                                                                                                                                                                                                                                                               |
| ADR-68 | **The default category taxonomy ships in a migration, not in `seed.sql`.** Twenty categories in three languages, inserted idempotently by `20260810001000_default_categories.sql`.                                                                                                                                                                                                                                                                                             | ADR-20 forbids _fake_ data, and this is not fake: it is the shop's own taxonomy, decided by the business, and a computer store that sells laptops has a Laptops category the day it opens. The distinction that decides the file is deployability — `seed.sql` is development fixture data and never runs on `db push` (ADR-25), so reference data the application cannot function without has to be a migration, exactly as the roles and permissions in 20260801000200 already are. Inserted flat rather than nested because that is the list the business gave; `parent_id` and the `path` trigger already support nesting, so an operator can build a hierarchy without a migration. Keyed on the Uzbek slug for idempotency, because `categories` carries no name or slug of its own since the localization migration and there is nothing else on the parent to match.                                                                                                                                                                                                       |
| ADR-67 | **Two permissions were added to the database — `orders.read` and `orders.update` — and no `orders.delete`.** Granted to `super_admin` (set-based, as ADR-44's migration does), `support_agent` (read + update) and `catalog_manager` (read). `support_agent`'s description changed from "Changes nothing" to match.                                                                                                                                                            | ADR-44 forbids the _registry_ inventing a permission, not the schema gaining one — an Orders module needs the database to name what it offers before the interface may offer it. There is no delete because an order is never deleted: a sale that fell through is `cancelled`, which keeps the phone number, the basket and the reason, all three of which the shop wants when the customer rings back. The support agent got update because that role _is_ the workflow — the person who rings the customer is the person who moves the status, and a read-only support role would leave nobody able to work an order.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-66 | **The review gate is an RLS policy, not an application check.** "Verified buyer, delivered order, one per purchased product" is a `with check` containing the `orders → order_items` join it depends on.                                                                                                                                                                                                                                                                       | The rule is the feature, and a rule that lives in a Server Action protects that action rather than the table. Written as a policy it survives the next action somebody adds in a hurry, a leaked anon key, and `service_role` being handed to a script. `services/reviews.service.ts` translates the 42501 refusal into a sentence a shopper can read, and deliberately does **not** say which of the three conditions failed — telling a caller _why_ an authorisation check failed is how a probe learns the shape of somebody else's order. Verified: `db:verify` asserts all four outcomes under `set role authenticated` with a real JWT claim, not around RLS.                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-65 | **`place_order()` is a `security definer` function and the only write path into `orders`. No role holds insert on `orders` or `order_items`.** It takes `[{product_id, variant_id, quantity}]` and **no prices**.                                                                                                                                                                                                                                                              | Three holes close at once. Prices are re-read from the catalog inside the transaction that writes the row, so a client-supplied total cannot sell a laptop for a dollar. The order and its lines become one transaction, so no order exists with nothing in it. And a guest order — `user_id is null` — has no ownership for a table-level insert policy to check, so with one an anonymous caller could append lines to any other guest's order; a definer function inserts both halves itself and there is nothing to append to. The cost is that checkout logic lives in SQL, which is harder to test than TypeScript — paid down by `db:verify`, which places a real order and asserts the snapshot survives re-pricing the catalog.                                                                                                                                                                                                                                                                                                                                           |
| ADR-64 | **The basket is client-side only. There is no `carts` table**, reversing the roadmap's Phase 4 plan.                                                                                                                                                                                                                                                                                                                                                                           | Phase 4 assumed server-side carts because it assumed online payment: a cart has to survive a redirect to a payment provider and come back. ADR-63 removed the provider, so a basket never leaves the tab it was filled in and the first thing worth persisting is the order. That drops anonymous cart sessions, merge-on-sign-in and an expiry job. The cost is real and accepted: a basket does not follow a shopper from desktop to phone. Reversible — the storage key in `components/cart/cart-provider.tsx` is the only coupling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-63 | **Bondo takes no payment online. `order_status` tracks a conversation, not a transaction**, and the old interface vocabulary (`pending`, `paid`, `fulfilled`, `refunded`) is gone.                                                                                                                                                                                                                                                                                             | This is how computer shops in Tashkent sell: the shopper leaves a phone number, a manager rings back to agree the configuration and the delivery, and cash settles at the door. Modelling it as a payment funnel with the payment step removed would leave `paid` as a column nobody updates and `delivery_fee_cents` guessed at checkout instead of quoted on the call. The seven statuses are each a sentence a manager can say out loud. Consequences: no payment provider, no webhook handler, no idempotency key — and `orders.phone` is required while email is not collected at all, because nobody here waits for a confirmation email.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-62 | **Variant stock lives in `inventory`, which gained a nullable `variant_id`, rather than a `stock_on_hand` column on `product_variants`.** `variant_id IS NULL` is the product's own stock; not-null is that configuration's.                                                                                                                                                                                                                                                   | The shortcut is a quantity on the variant row, and ADR-24 already says why it is wrong: two writable copies of a quantity are two quantities, and the ledger stops explaining the number. Keeping one table means one append-only guard, one movement type enum and one audit trail — re-proven at the variant level by `db:verify`, which now asserts that a direct write is refused and that a variant movement moves variant stock without touching the product's. The cost is that `inventory`'s primary key moved off `product_id` onto a surrogate, with two partial unique indexes carrying what the key used to mean; a plain `unique (product_id, variant_id)` would not work, because NULLs are distinct in a unique index and a product could acquire two product-level rows.                                                                                                                                                                                                                                                                                           |
| ADR-61 | **`audit_logs.actor_id` is deliberately not a foreign key.** The log does not depend on `auth.users` and keeps both `actor_id` and `actor_email` after an account is deleted.                                                                                                                                                                                                                                                                                                  | It could not be one. `on delete set null` fires an UPDATE, and the append-only guard (ADR-27) rejects every UPDATE — so the two constraints made user deletion impossible, opaquely (**K-22**). Weakening the guard was the alternative and it is wrong twice: one exception is how a log stops being evidence, and nulling the actor erases the single field the row exists to hold. An audit entry whose actor disappears when the account closes cannot answer the only question ever asked of it. Erasure is still possible — it is now a deliberate redaction rather than a silent side effect of closing an account, which is what a data-protection request actually calls for.                                                                                                                                                                                                                                                                                                                                                                                             |
| ADR-60 | **The password-reset action swallows a rate-limit failure; every other action surfaces it.**                                                                                                                                                                                                                                                                                                                                                                                   | The service surfaces rate limiting so a caller is never left clicking a button that is silently doing nothing. On the reset endpoint specifically that is an enumeration oracle: sending mail to a _known_ address consumes quota and errors, while an unknown address returns cleanly because no mail is attempted — so the error distinguishes the two. Found by measurement, not review: it appeared against the live project exactly when the mail quota was exhausted, which is also when an attacker would be probing. The visitor still sees the same confirmation either way, so nothing they could act on is hidden; the failure is logged server-side without the address.                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-59 | **Registration creates a profile and a default wishlist, and does not assign a "customer" role.** Both rows are written by `handle_new_user()` inside the signup transaction.                                                                                                                                                                                                                                                                                                  | The Phase 4A brief asks for a default customer role and this schema has none, deliberately, since Phase 2. Roles exist to carry _staff_ permissions (ADR-21); a customer holds none, and every customer-facing policy keys off `auth.uid() = user_id` rather than a role (ADR-22). A permissionless `customer` row would grant nothing, be read by no policy, and be assumed load-bearing by the next person to see it — the same class of mistake as ADR-44, where the brief's role names did not match the schema's. Being a customer is the absence of an `admins` row. The wishlist, by contrast, is a real table with a real first use, so it is created — in the trigger rather than in application code, because a second call after `signUp()` can fail and leave the orphan the phase exists to prevent.                                                                                                                                                                                                                                                                  |
| ADR-58 | **The per-module folder convention spans layers rather than collapsing them.** Screens live in `components/admin/modules/<id>/`; data access stays in `services/`, mutations in `actions/`, view models in `types/`, strings in `messages/`.                                                                                                                                                                                                                                   | The Phase 3D brief proposed colocating `services/` and `actions/` inside each module folder. Two layer rules make that unsafe rather than merely unconventional: a service must never import React and must stay callable from a webhook, a job or a script, and a service nested in a route folder is one somebody eventually imports a component into; and Server Actions are public HTTP endpoints validated centrally through `createAction()`, so scattering them under `app/` makes "is every action validated" a question nobody can answer by looking. The convention is still identical for every module, which is what the brief was actually asking for — it just spans four folders instead of one. Recorded rather than resolved silently, because the next person reading the brief will ask why.                                                                                                                                                                                                                                                                    |
| ADR-57 | **Canonical, Open Graph and card-type columns live on the translation row, and Twitter inherits from Open Graph rather than duplicating it.** Five columns per table — `canonical_url`, `og_title`, `og_description`, `og_image_path`, `twitter_card` — on `product_`, `category_`, `brand_` and `content_page_translations`.                                                                                                                                                  | The brief specifies canonical, Open Graph and Twitter fields in the shared SEO panel and the schema had none of them, so CLAUDE.md § 12 decides the order: migration first, then types, then the panel. Building the panel first is precisely **K-15** again — a form collecting data with nowhere to go. They are per-locale for the same reason `seo_title` is: a share card carries a headline and usually an image with words baked into it. Nine columns would be the naive shape; five plus a resolution chain (`twitter:title → og_title → seo_title → name`) is fewer places for the same sentence to drift, and a store that writes nothing still emits complete cards. `twitter_card` is an enum so `Enums<"twitter_card">` reaches the select and the interface cannot offer a value the insert rejects.                                                                                                                                                                                                                                                                |
| ADR-56 | **One form layout for every module**: `general → media → pricing → inventory → seo → localization → advanced → publish`. A module declares a subset; it never reorders and never invents.                                                                                                                                                                                                                                                                                      | Enforced by the type rather than by review — `ModuleForm`'s `sections` prop is keyed by the canonical union and rendered in the order declared in `lib/admin/module.ts`, so writing them in a different order in the source changes nothing. The order runs from what the thing _is_ to whether the world can _see_ it, which puts the decisions with consequences last and identically placed in every module. Section titles default to `admin.form.sections.*`, so "General" is translated once instead of appearing as "Basics", "Details" and "Overview" across three modules. The product editor was rebuilt onto it as the worked example.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-55 | **The interface speaks capabilities; the database keeps its permissions.** Seven capabilities per module (`view`, `create`, `update`, `delete`, `publish`, `settings`, `export`), each mapped by the module's `grants` table to an existing permission or to `null`.                                                                                                                                                                                                           | ADR-44 forbids inventing role or permission names for the UI, and it should: the twenty permissions are the schema's and a trigger protects them. But a uniform interface needs a uniform question, so the indirection gives every module the same seven questions without the database gaining a single new answer. `null` carries real information — it means the module does not offer that capability **to anybody**, super admin included, which is exactly true of `audit.create` and `inventory.delete` where a trigger refuses the write regardless of policy (ADR-24, ADR-27). Resolving capabilities once per route and passing the _answers_ down means the permission model never reaches the browser.                                                                                                                                                                                                                                                                                                                                                                 |
| ADR-54 | **Every admin module is a record in `lib/admin/modules.ts`**, and navigation, route guards, form sections and permission checks are derived from it rather than maintained beside it.                                                                                                                                                                                                                                                                                          | `lib/admin/navigation.ts` was a second hand-written list of every module's href, icon and permission set. Two lists, one of them edited, is how a module ends up reachable from the command palette and missing from the sidebar for one role — and the panel gains a module roughly every phase, so the number of chances grows. The failure modes this closes are the quiet ones: an ungated delete button, a nav entry that 404s, a form section in a different place. Verified rather than assumed: the derived navigation was compared against the previous lists for all five system roles and the visible set is identical. Cost: adding a module now requires editing a file that every module shares, which is the trade — one place to get right instead of six places to keep in step.                                                                                                                                                                                                                                                                                  |
| ADR-1  | One-directional flow: component → service → Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                          | A component that queries directly is a query the team cannot find later. This is the constraint the whole structure rests on.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-2  | Money stored as **integer minor units** (cents).                                                                                                                                                                                                                                                                                                                                                                                                                               | Floating point does not belong near a price. Enforced by `formatPrice()` taking minor units.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ADR-3  | Slugs persisted on the row, never derived on read.                                                                                                                                                                                                                                                                                                                                                                                                                             | Deriving a slug on read means renaming a product silently breaks every existing link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-4  | RLS is the authorisation boundary. Server checks are defence in depth.                                                                                                                                                                                                                                                                                                                                                                                                         | The anon key is public. Anything not enforced by RLS is not enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-5  | `getUser()` everywhere; `getSession()` never.                                                                                                                                                                                                                                                                                                                                                                                                                                  | `getSession()` trusts the cookie as-is and can be spoofed. `getUser()` validates the JWT against the Auth server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-6  | Server Components by default; `"use client"` pushed as far down the tree as possible.                                                                                                                                                                                                                                                                                                                                                                                          | Client JS is opt-in, not the default. This is what keeps First Load JS near the framework floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-7  | `lib/env.ts` is the environment contract; only `next.config.ts` and `lib/logger.ts` read `process.env` directly, both documented at the point of use.                                                                                                                                                                                                                                                                                                                          | Fail fast at boot with a readable message, rather than `undefined` deep inside a request three weeks later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-8  | `lib/logger.ts` must not import `lib/env.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                  | It is imported by Client Components. The import chain put Zod and the env schema in the shared client bundle — 67 kB, measured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-9  | `types/` contains declarations only; runtime helpers live in `lib/`.                                                                                                                                                                                                                                                                                                                                                                                                           | Importing from `types/` must be provably free. `ok()`/`err()` moved to `lib/result.ts` for this reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-10 | `utils/` may not import env, Supabase or React.                                                                                                                                                                                                                                                                                                                                                                                                                                | A formatter that drags Zod into the bundle every time a price renders is not a utility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-11 | Middleware skips Supabase entirely for requests with no `sb-*-auth-token` cookie.                                                                                                                                                                                                                                                                                                                                                                                              | Most storefront traffic is anonymous. Calling `getUser()` for them adds a round trip to Auth on every page view and burns auth quota.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-12 | `createClient()` and `getCurrentUser()` memoised with React `cache()`.                                                                                                                                                                                                                                                                                                                                                                                                         | Per-request, not cross-request. Six components asking for the user cost one JWT validation, not six.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-13 | `createAction()` calls `unstable_rethrow()` before handling any error.                                                                                                                                                                                                                                                                                                                                                                                                         | `redirect()` and `notFound()` signal by throwing. Catching them turns a redirect into "Something went wrong."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-14 | Middleware does authentication only, never authorisation.                                                                                                                                                                                                                                                                                                                                                                                                                      | Role checks need a database read. A query on the Edge in front of the whole site is not a trade worth making.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-15 | No canonical URL in the root layout.                                                                                                                                                                                                                                                                                                                                                                                                                                           | A root canonical is inherited by every page that does not override it, telling crawlers the whole catalog duplicates one URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-16 | `NEXT_PUBLIC_SITE_URL` optional, falling back to `NEXT_PUBLIC_VERCEL_URL` then localhost.                                                                                                                                                                                                                                                                                                                                                                                      | Preview deployments get a hostname that cannot be known in advance. Without the fallback every preview emits production URLs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-17 | `next.config.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` is missing.                                                                                                                                                                                                                                                                                                                                                                                                            | An empty `remotePatterns` list builds fine and 404s every product image in production — a failure that reaches customers before developers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ADR-18 | No root `app/loading.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Both pages are static. A root loading file flashes a fallback on every navigation and buys nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-19 | `lib/utils.ts` stays where it is despite the `lib`/`utils` overlap.                                                                                                                                                                                                                                                                                                                                                                                                            | `components.json` and every generated shadcn component import `cn` from `@/lib/utils`. Moving it fights the generator forever.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-20 | No fake or seeded data, in any phase. **Refined by ADR-25.**                                                                                                                                                                                                                                                                                                                                                                                                                   | Placeholder data hides empty states, and empty states are where ecommerce UIs actually break.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-21 | Permissions are never held by a user directly. Users hold roles; roles hold permissions.                                                                                                                                                                                                                                                                                                                                                                                       | At 100+ administrators, per-user grants become impossible to audit. Revoking a capability from everyone must be one DELETE, not a migration over users.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-22 | Staff status lives in its own `admins` table, not an `is_admin` column on `profiles`.                                                                                                                                                                                                                                                                                                                                                                                          | `profiles` is the one table customers may UPDATE. A privilege flag on it is one mis-scoped policy away from self-service privilege escalation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-23 | Every RLS helper is `SECURITY DEFINER` with `set search_path = ''` and fully schema-qualified references.                                                                                                                                                                                                                                                                                                                                                                      | DEFINER is required — a policy on `user_roles` that queries `user_roles` recurses forever. The pinned search_path stops a caller shadowing `public.admins` with their own table and having it read with elevated rights.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-24 | Stock lives only in `inventory`. `products` has no stock column, and `inventory.quantity_on_hand` may change only through an `inventory_movements` insert — enforced by a trigger that rejects every other write.                                                                                                                                                                                                                                                              | Two writable copies of a quantity are two quantities. The guard makes "never overwrite inventory silently" a mechanism rather than a policy: a Studio edit raises an exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-25 | **Refines ADR-20.** Development-only seed data is permitted in `supabase/seed.sql`, which runs on local `db reset` only and aborts if the database already holds products or admins.                                                                                                                                                                                                                                                                                           | ADR-20's reasoning was about content the storefront ships — placeholder products hiding empty states. A local fixture never reaches a user, and Phase 2 has no UI for it to hide. The abort guard is what keeps the distinction real rather than intended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-26 | Category nesting stores a trigger-maintained `path uuid[]` alongside `parent_id`, with a GIN index.                                                                                                                                                                                                                                                                                                                                                                            | `parent_id` alone needs a recursive CTE per page view. The path pays that cost once per write, and writes are rare. Cycles are rejected at the trigger, because a cycle in a category tree is an infinite loop in every breadcrumb.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ADR-27 | `audit_logs` and `inventory_movements` are append-only, enforced by a trigger rather than by the absence of an RLS policy.                                                                                                                                                                                                                                                                                                                                                     | RLS does not constrain `service_role`. An audit log that anyone holding the service key can rewrite is not evidence of anything.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-28 | Anonymous read extends to visible categories, brands, published-product images/specs, public settings and live banners — not products alone.                                                                                                                                                                                                                                                                                                                                   | A product page must name its brand and the nav must list categories. Restricting these to `service_role` would move the whole storefront off RLS, which is the opposite of the intent. Recorded because the Phase 2 brief said "read published products only".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-29 | `types/database.ts` was left stale rather than hand-written when the generator could not run.                                                                                                                                                                                                                                                                                                                                                                                  | An empty `Tables` makes every `from()` a compile error, so the gap fails loudly. Fabricated types would be plausible, wrong, and unchecked — and would break the rule that this file is generated output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-30 | GRANTs are written out explicitly instead of relying on Supabase's default privileges.                                                                                                                                                                                                                                                                                                                                                                                         | A privilege model that exists only as a platform default is one nobody can review. `anon` gets SELECT on exactly the seven tables with an anonymous read policy, so a mistaken policy still meets a closed second gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-37 | Orange is used for **price reductions only** — the sale price, the discount badge. Star ratings are monochrome and low stock is emphasised with weight, not hue.                                                                                                                                                                                                                                                                                                               | An accent that means two things means neither. An amber star next to an orange sale price makes a well-reviewed product look discounted at a glance, which is the one misreading a storefront cannot afford. Verified in the rendered page: zero accent-coloured stars, 36 accent elements and all of them a price cut.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-50 | **Database-first**: the schema is the source of truth, enums in `types/` derive from `Enums<"…">`, and `npm run enums:check` fails the build on divergence. Vocabularies with no column yet are allowed but must be declared with a reason.                                                                                                                                                                                                                                    | Stated as policy by the user and adopted as CLAUDE.md § 12. It is worth mechanical enforcement because the failure is silent and late: a hand-written union compiles, renders a `<Select>`, and is rejected by the enum at insert — in production, on a value the operator was offered. **K-16** was exactly that, and it survived a whole phase because nothing compared the two. Adopting the policy closed it: `product_status` and `inventory_movement_type` are now derived, and `product_visibility` became the separate control the schema always had. The declared-exception list keeps honest gaps (no `orders` table yet) visible rather than indistinguishable from mistakes.                                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-53 | Localized content is **not publishable until every supported language has copy**, enforced in the service layer by `isPublishable()` and surfaced by the same `coverageOf()` the form renders.                                                                                                                                                                                                                                                                                 | A product live in one language puts an untranslated page in front of a shopper in the other two, which is the failure the whole translation architecture exists to prevent. Putting the rule in the service rather than the form means it also holds for an import script, and sharing one function with the UI means a form that says "complete" and a save that refuses can never disagree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ADR-52 | Slugs are **per locale**, unique within a locale rather than globally, and the parent's `slug` column was dropped.                                                                                                                                                                                                                                                                                                                                                             | A Russian shopper's URL should read as Russian, and `/ru/products/videokarta-rtx-4090` is only expressible if the slug lives on the translation row. Uniqueness is scoped to the locale because "monitor" may legitimately be one product's Uzbek slug and another's English one. Keeping a canonical slug alongside would leave the application choosing between two sources of truth — the duplicate concept this phase removed. Routing adopts it when the storefront is wired; the column is populated and unused until then.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-51 | Translations are **normalized rows**, one per `(entity, locale)`, not a `jsonb` blob — and the single-language columns were dropped rather than kept alongside.                                                                                                                                                                                                                                                                                                                | A blob cannot be constrained (`name` NOT NULL per language), cannot carry a per-locale `tsvector`, and cannot have a unique index on a localized slug. It also makes `where locale = 'ru'` a scan with no statistics instead of a query. Dropping the old columns is the harder half and the more important one: two places to write a product name is exactly the duplicate concept K-15/K-16 were. Existing rows are migrated to `en` in the same migration, so no deployment observes both shapes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-49 | Services take a Supabase client as an argument and never construct one; every read uses an explicit column list, never `select("*")`.                                                                                                                                                                                                                                                                                                                                          | The caller is the only thing that knows whether a query should run as the visitor (RLS enforced) or as the service role (RLS bypassed). A service that constructs its own client picks for every future caller, and the first reuse silently bypasses authorisation. Explicit columns matter for a second reason here: `products.search_vector` is a `tsvector` that nothing renders, and `select("*")` ships it on every row of every listing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-48 | `types/database.ts` is generated by running `@supabase/postgres-meta` against PGlite over the Postgres wire protocol, rather than by `supabase gen types`.                                                                                                                                                                                                                                                                                                                     | `supabase gen types` runs its generator in a container **even with `--db-url`**, and this machine has no container runtime — which is what kept **K-3** open through three phases and blocked every query in the project. `postgres-meta` is the package that container runs, and the two calls made here (`getGeneratorMetadata` then the TypeScript template) are exactly what its `/generators/typescript` route does. So the output is generated by the official generator from the real migrations, not hand-written. It reflects the migrations rather than a hosted project: `db:types:remote` remains the authority once one is linked, and a diff means drift.                                                                                                                                                                                                                                                                                                                                                                                                            |
| ADR-47 | Product `name` became `LocalizedText`, and `mocks/catalog.ts` gained a `modelName()` helper for the identical case.                                                                                                                                                                                                                                                                                                                                                            | The brief lists Product Name as a localized field, and it is right to: "Bondo Forge RTX 4080 Gaming PC" is "Игровой компьютер Bondo Forge RTX 4080" in Russian. Manufacturer model numbers are the exception — "RTX 4090" is a trademark and identical everywhere — so `modelName()` declares the three copies once rather than inviting one of them to drift. This reversed the Phase 3A decision to treat product names as identifiers; it touched ten files and was authorised by the brief (CLAUDE.md § 2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ADR-46 | The admin panel was built now, out of roadmap order — the roadmap places it at Phase 6, behind cart, checkout and accounts.                                                                                                                                                                                                                                                                                                                                                    | The brief asked for it and named it Phase 4. Recorded rather than done quietly because the skipped dependency is real and shows in the result: with no `orders` table the dashboard's revenue, order and customer figures are fixtures, and the order-management module Phase 6 describes cannot be built. The roadmap is reordered rather than rewritten, so the debt stays visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ADR-45 | The admin is reachable in **development only**, gated by `NODE_ENV` inside the middleware chain. Production behaviour is unchanged: `/admin` redirects to sign-in.                                                                                                                                                                                                                                                                                                             | Without it the panel could not be built at all — `/admin` is a protected route, there is no `/sign-in` page (**K-2**), so every request 404s after the redirect. `NODE_ENV` is inlined as a literal by Next.js, so the production bundle contains `false` rather than a check: there is no runtime variable to misconfigure and the branch is unreachable in a deployed build. **It is not authorisation and does not close K-1** — it is deleted when the real role check lands. Verified against `next start`: all three locales answer `307 → /<locale>/sign-in`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ADR-44 | The admin renders the Phase 2 authorisation model transcribed into `lib/admin/permissions.ts`, rather than inventing role names for the UI.                                                                                                                                                                                                                                                                                                                                    | The brief named five roles (Owner, Super Admin, Admin, Inventory Manager, Content Manager) that do not match the five the schema ships and a trigger protects. Inventing a parallel vocabulary would mean the interface offers capabilities the database refuses. The constant carries the exact grants from the migration, the Roles screen prints them, and the union type is what will check the eventual query. Divergence is the risk to watch; a test can assert the two sets match once **K-3** is closed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ADR-43 | **Extends ADR-36.** `mocks/admin.ts` is permitted, on the same terms, and derives its product list from `mocks/catalog.ts` rather than duplicating it.                                                                                                                                                                                                                                                                                                                         | One product list, so a product edited in the admin cannot disagree with the same product on the storefront — which is also the relationship the real system has: one `products` table, two projections. Dates are derived from a fixed epoch rather than `Date.now()`, because a module-scope "3 hours ago" differs between server and client and fails hydration, and freezes at build time when prerendered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-42 | ~~An unmatched URL under a locale is caught by `app/[locale]/[...rest]/page.tsx`, which calls `notFound()`; `app/layout.tsx` exists as a passthrough that renders no markup.~~ **Superseded by ADR-82.** Both halves were reversed: the catch-all is deleted, and the root layout renders the document. The passthrough is what left every 404 in the framework's own shell.                                                                                                   | Two separate Next.js facts, both discovered by observation rather than from the docs. A `not-found.tsx` inside a segment only catches `notFound()` raised by a route that **matched** — an unknown path matches nothing, so it fell through to the framework's built-in English 404 with no `<html lang>`. And with no root `app/layout.tsx`, the `not-found` convention has no root to resolve against and `app/[locale]/not-found.tsx` is ignored entirely: an unknown product slug returned **200 with an empty body**, silently, with nothing logged in dev or production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-41 | ~~`dynamicParams = false` on `app/[locale]/products/[slug]`.~~ **Superseded by ADR-81.** The guard was dropped when the route moved to on-demand rendering, and the soft 404 it prevented came straight back. The boundary is now removed structurally instead.                                                                                                                                                                                                                | Correctness, not caching. `products/loading.tsx` puts a Suspense boundary above the route, so the response shell flushes with **200** before the page body runs and the `notFound()` inside it can no longer change the status — a soft 404 that invites dead product URLs into the search index. Refusing unknown params up front makes Next.js answer 404 before streaming starts. Revisit when the catalog outgrows build-time prerendering: ISR needs `true`, and the soft 404 must then be solved by moving `loading.tsx` off this route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-40 | Locale is **always** in the URL, including the default: Uzbek lives at `/uz`, never at `/`. Persisted in `NEXT_LOCALE`, negotiated from `Accept-Language` only when no cookie exists.                                                                                                                                                                                                                                                                                          | An unprefixed default gives every Uzbek page two addresses, which costs a canonical tag on every route to stop crawlers treating the site as duplicated, and makes `hreflang` a special case for one locale out of three. One shape for all three is worth one redirect from `/`. Cookie before `Accept-Language` because an explicit choice must outrank a browser default — verified: a `NEXT_LOCALE=uz` cookie beats an `en-GB` header.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-39 | **Interface chrome lives in `messages/`; catalog copy lives on the record** as `LocalizedText` (`Record<Locale, string>`). Specification labels are the exception — a shared vocabulary keyed into the `product` namespace.                                                                                                                                                                                                                                                    | They are different things with different authors and different lifecycles. "Add to basket" is written once by a developer, is identical on every page, and changes with a deploy. A product description is written per row by a merchandiser and in Phase 3B comes from the database — putting it in a message file would build the wrong pattern and then require unpicking. Making `LocalizedText` a **required** record of every locale means a product cannot be added in one language: TypeScript rejects it, which is the compile-time half of the policy in CLAUDE.md § 11. Spec labels go the other way because "Capacity" appears on memory, storage and batteries alike — three translations beat the same three on every row.                                                                                                                                                                                                                                                                                                                                           |
| ADR-38 | next-intl, with `[locale]` as the routing segment, rather than a hand-rolled context or a heavier framework.                                                                                                                                                                                                                                                                                                                                                                   | It is the only option that gives ICU plurals, Server-Component-native translation (`useTranslations` works without a client boundary, so a grid of sixty product cards still ships zero JavaScript for its text), and locale-aware `Intl` formatting from one contract. A hand-rolled system reaches the same place eventually and arrives without plural rules — Russian needs `few` and `many`, which a ternary cannot express. Cost: the middleware bundle grew 93 kB → 105 kB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ADR-36 | **Refines ADR-20.** Mock catalog data is permitted in `mocks/`, imported only by `app/` and `components/`, for the interface phase only.                                                                                                                                                                                                                                                                                                                                       | ADR-20 forbids fake data because it hides empty states. The Phase 3A brief requires building the interface before the schema is wired, so the exemption is scoped: nothing in `services/`, `actions/` or `lib/` may import it, the shapes are `types/catalog.ts` so services drop in without touching components, and the empty states ADR-20 protects are built and reachable today — an empty basket, an empty wishlist, a filter matching nothing. Tracked as **D-11** so the folder is deleted rather than forgotten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ADR-35 | **The middleware chain does not import `lib/env.ts`.** `supabase/session.ts` reads its two `NEXT_PUBLIC_*` values from `process.env` directly. Same shape as ADR-8 for `lib/logger.ts`, applied to the Edge bundle.                                                                                                                                                                                                                                                            | `lib/env.ts` validates the whole public contract with Zod **at module scope and throws**. In an Edge Function module scope runs once per isolate, so a throw there fails _every_ request and Vercel surfaces it only as `MIDDLEWARE_INVOCATION_FAILED` — no file, no line, no variable. It also validated `NEXT_PUBLIC_SITE_URL`, which nothing in this chain uses, and which is **not inlined when unset at build**: it stayed a runtime `process.env` read whose value the build never checked, and `next.config.ts` does not run inside the Edge Function. Measured: middleware bundle 383 kB → 325 kB, Zod removed entirely.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ADR-34 | **Every module reachable from `middleware.ts` imports by relative path, not the `@/` alias.** The rest of the codebase keeps the alias.                                                                                                                                                                                                                                                                                                                                        | Vercel resolves the middleware import graph itself when packaging the Edge Function — from source, transitively, without applying tsconfig `paths`. Anything it cannot resolve fails the deployment with `The Edge Function "middleware" is referencing unsupported modules`. Proven by converting only the entry file: the error moved one level down, from `middleware.js: @/supabase/session` to `supabase/session.js: @/lib/env, @/lib/routes`. Type-only imports are erased before resolution and were never named, but are converted too, since one edit turning one into a value import would break the deploy for a reason nobody would connect to that line. Chain today: `middleware.ts` → `supabase/session.ts` → `lib/env.ts`, `lib/routes.ts`, `types/database.ts`.                                                                                                                                                                                                                                                                                                   |
| ADR-33 | The production build uses **webpack**; `--turbopack` is kept on `dev` only.                                                                                                                                                                                                                                                                                                                                                                                                    | Vercel's Edge bundler expects `.next/server/middleware.js`. Turbopack emits no such file — it emits three chunks, one named `[root-of-the-server]__….js`, and Vercel then fails with `The Edge Function "middleware" is referencing unsupported modules: @/supabase/session`. Webpack also measured smaller here: First Load JS 139 kB → 103 kB, middleware 162 kB → 109 kB. `dev` keeps Turbopack, where the speed matters and nothing is deployed. Revisit per **K-12**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ADR-32 | Env URLs are validated with `z.url({ protocol: /^https?$/ })` — scheme restricted, host **not** — plus an explicit scheme check in the preflight; and a value with leading or trailing whitespace is rejected rather than trimmed.                                                                                                                                                                                                                                             | Plain `z.url()` and `URL.canParse()` accept `postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres`, the connection string Supabase shows beside the project URL; it would validate and then fail at the first query. `z.httpUrl()` fixes that but also demands a public-looking domain, rejecting `http://localhost:3000` and `http://127.0.0.1:54321` — the local Supabase URL `.env.example` prescribes. Restricting the scheme was the requirement; restricting the host broke local development. Whitespace from a paste survives every truthiness and length check, making a credential quietly wrong at runtime; trimming silently would hide the mistake from whoever can fix it at source.                                                                                                                                                                                                                                                                                                                                                                           |
| ADR-31 | **Extends ADR-17.** `next.config.ts` preflights the whole required public env set, not only `NEXT_PUBLIC_SUPABASE_URL`, and reports every problem at once.                                                                                                                                                                                                                                                                                                                     | A missing `NEXT_PUBLIC_SUPABASE_ANON_KEY` was not caught until page-data collection, where `lib/env.ts` throws while importing the root layout. Next surfaces that as `Failed to collect page data for /_not-found` — naming an innocent file and never mentioning environment variables. The preflight fails just as hard, one stage earlier, naming the variable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

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

**Applied to the hosted project.** `supabase db push` ran on 2026-08-11:
`pgxqnezwrwfgrmamlxhs` now carries all 17 migrations and 36 tables, matching the
committed types. Verified through the **anonymous** client, so these are the
rows a real visitor sees through RLS — not a service-role read.

---

## Responsive UI (Phase 3E)

🟡 **Two defects found by measurement and fixed. The audit itself is barely
started.**

Every fix here was measured in a browser before and after, not reasoned about:

| Defect                        | Before                | After              |
| ----------------------------- | --------------------- | ------------------ |
| Horizontal scroll at 320px    | 35px of overflow      | **0**              |
| Footer height at 320px        | 1062px (1.33 screens) | **543px (0.75)**   |
| Footer link touch target      | ~20px                 | 44px on touch      |
| **Home page document height** | **54,246px**          | **3,323px (−94%)** |
| **Home page sections**        | 108                   | **6**              |
| **Listing filter strip**      | 424px, 102 chips      | **64px, 13 chips** |
| **Footer height at 1280px**   | 870px (1.21 screens)  | **314px (0.44)**   |
| **Footer height at 768px**    | 546px                 | **426px**          |
| **Footer height at 375px**    | 523px (0.64 screens)  | **364px (0.45)**   |

### The page was not tall because of the footer

The brief assumed the footer, and the footer was only 2% of the problem. The
measurement said so immediately: at 1280px the document was **54,246px** and the
footer was **870px** of it.

**The cause was the category taxonomy meeting two loops that had no cap.** The
home page rendered one `Section` per category and the listing rendered one filter
chip per category. Both were written when there were twenty categories and both
survived the jump to 102 (ADR-72) without anybody re-measuring:

- **102 sections of ~494px**, all empty, because the catalog has no products;
- **102 `listProductsByCategory` calls**, each of which re-fetched the whole
  category list before running its own query;
- a **424px** filter strip above every listing.

Fixed by deriving both from the navigation tree instead of the flat list
(**ADR-75**): the home page takes at most six _departments_ and skips any with
`productCount === 0`, so an empty shop now fetches nothing and renders no rails
at all; the listing offers the twelve departments plus one level of narrower
filters. `catalog.reads` also memoises the raw category read per request, so the
duplicate fetches collapse into one.

Nothing was hidden to achieve this. An empty rail has no content by definition,
and every category remains reachable — from the mega menu, the mobile accordion,
the footer's department list and the listing's filter strip.

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

### The footer, rebuilt

Compact, and honest about what the shop has. Three blocks on a twelve-column
grid — brand 4, departments 5 (two sub-columns from `lg`), account 3 — collapsing
to three equal columns at `sm` and to two `<details>` disclosures on a phone.
Still a Server Component with no client JavaScript.

**Three things were removed rather than restyled**, because each was showing a
visitor something that was not true:

| Removed                                                    | Why                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| The newsletter form                                        | No endpoint records a signup; the toast said so                       |
| Four social "links" (`X`, `YouTube`, `LinkedIn`, `GitHub`) | Hardcoded strings for accounts that do not exist                      |
| Eight inert grey rows + an apologetic footnote             | Delivery, warranty, returns, contact, about — **no such pages exist** |

The last one is the reason there are three columns and not four. `content_pages`
exists in the schema and has **no rows**; writing delivery windows, warranty
terms and a returns policy is the business's job, and inventing them would be
the fake content ADR-20 forbids. They come back as links the day the pages have
copy — the footer needs one array entry each.

**Copy corrected, not restyled.** The footer claimed a **three-year** warranty
while the home page's service highlights — real database rows — say one year.
The site contradicted itself on its main trust claim. Every warranty string is
now one year, in all three languages, and the hero's eyebrow and assurance row
were wrong too. Also `butlovchi qismlar` → `kompyuter qismlari` throughout the
Uzbek copy and on the components department itself, at the business's request.

### Not done — most of the brief

Stated plainly because the request was much larger than what was delivered:

- **The "freezes when buttons are pressed" report was not investigated.** No
  latency was measured. The cause is unknown and nothing was changed for it.
- **The breakpoint sweep covered 320px and one desktop width, on the home page
  only.** Eight of the ten widths, and every route other than the home page,
  are unaudited.
- **The header was measured (65px) and not changed.**
- ~~**17 tap targets under 40px**~~ — fixed in ADR-83 for the storefront's touch
  paths. What remains at 390px is the visually-hidden skip link, breadcrumb and
  in-sentence text links (the WCAG 2.2 SC 2.5.8 inline exception), and admin
  tables, which were not part of this pass. Originally recorded as: the header's 32×32 icon
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

## Service highlights

🟢 **Complete end to end** — schema, service, actions, storefront section and a
full admin module. The first feature in this project built database-first from
the migration to the screen in one pass.

The trust row under the hero: six promises a shopper reads before deciding
whether to buy from a shop they have not used. Warranty, build time, delivery,
who assembles it, whether it is tested, whether the parts are genuine.

**None of it is hardcoded.** `20260811001000_service_highlights.sql` creates
`service_highlights` and `service_highlight_translations` and seeds the six
defaults in uz/ru/en. An operator adds, edits, deletes, reorders, hides and
re-icons them from `/admin/highlights` without a deploy.

| Layer           | State                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Migration       | ✅ 2 tables, 5 policies, 4 triggers, seeded with the six defaults           |
| Generated types | ✅ 36 tables from 17 migrations                                             |
| Service         | ✅ list, get, save (upsert + translations), delete, reorder, set visibility |
| Server Actions  | ✅ save, delete, reorder, visibility — all gated on `banners.manage`        |
| Storefront      | ✅ `ServiceHighlights`, directly under the hero, renders nothing when empty |
| Admin module    | ✅ registry entry, route, manager with drag-reorder and a 3-language dialog |
| Localization    | ✅ `adminHighlights` namespace; 17 namespaces × 3 locales, 894 keys each    |

### Decisions worth knowing

**The copy lives on the record, not in `messages/`** (ADR-39 applied): "1 yillik
kafolat" is the shop making a promise, not the interface labelling a button. The
section _heading_ stays in `messages/home.json`, because that is chrome.

**The icon is a lucide name, not an upload** (**ADR-69**). Stored as text,
resolved by an explicit map in `components/home/highlight-icon.tsx`, and
validated against that same map in the Server Action so the two cannot drift. A
database check constraint enforces the identifier _shape_; the action enforces
_membership_. Deliberately not a database enum — adding a glyph would then be a
migration.

**No permission was invented.** Highlights are storefront content with the same
lifecycle and the same author as banners, so they reuse `banners.read` and
`banners.manage` (ADR-44 holds).

**Reordering saves immediately, editing saves on submit.** Dragging a row and
then having to press Save is how an operator loses an arrangement they thought
they made. The dialog is the opposite: half-typed copy in three languages must
not reach the storefront between keystrokes. The list is optimistic and reverts
with a toast if the action refuses.

**All three languages are required** by the action's schema, not merely
encouraged. A highlight missing its Russian renders a gap in the trust row for
every Russian-reading visitor, and there is no sensible fallback to show.

### Verified

`npm run verify` passes: 126 schema assertions (up from 119) and a production
build. Seven of the new assertions are the highlights:

| Assertion                                               | Result               |
| ------------------------------------------------------- | -------------------- |
| the six defaults were seeded by the migration           | 6 found              |
| every highlight exists in all three languages           | 3,3,3,3,3,3          |
| they carry a display order and are visible              | 1,2,3,4,5,6          |
| the warranty highlight carries its three written titles | uz/ru/en all present |
| an icon name that is not an identifier is refused       | ✅ check constraint  |
| deleting a highlight cascades its translations          | ✅                   |
| the seed does not resurrect a deleted highlight         | 5 remain             |

**Seen rendering, against the live database.** All 17 migrations are applied to
`pgxqnezwrwfgrmamlxhs`. The section renders six cards with their icons directly
under the hero, in position 1 of the page's sections, in Uzbek and Russian, one
column at 320px with zero horizontal overflow.

**Removed:** `components/home/value-props.tsx` and the four hardcoded claims in
`home.valueProps`. Its heading survives as the section's.

---

## Post-order account creation

🟡 **The mechanism is complete and proven. The screens it hangs off are not.**

A guest orders, then registers from the confirmation page, and the order they
already placed appears in their history — the same row, moved, never copied.

### The security decision, which is the whole feature

The obvious implementation is "on registration, claim every order whose phone
matches". **That is a data-disclosure hole**: a phone number is not a secret, so
anyone who knows a customer's number could register with it and read that
customer's name, address, basket and totals. Matching on the order reference is
worse — `BND-001042` is sequential by design, because a manager reads it down the
phone.

So a claim requires proof that the claimant placed the order, and the only party
holding that proof is the browser that placed it (**ADR-70**):

| Property                    | How                                                            |
| --------------------------- | -------------------------------------------------------------- |
| Unguessable                 | `claim_token uuid`, random, issued only to the placing caller  |
| Never exposed               | httpOnly cookie; **not** in the action's return value or a URL |
| Single use                  | Claiming nulls the token                                       |
| Guest orders only           | `place_order` issues one only when `auth.uid()` is null        |
| Cannot steal an owned order | `claim_orders` matches `user_id is null`                       |
| Idempotent                  | A second call matches nothing and returns 0                    |

The trade: a guest who clears cookies loses the automatic link. That is the
correct way to fail — they still have the order, the shop still has their phone
number, and support attaches it by hand. The alternative fails silently in favour
of whoever guessed a phone number.

### Built

| Piece                          | State                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `claim_token`, `claimed_at`    | ✅ `20260812001000_guest_order_claim.sql`                    |
| `place_order` issues a token   | ✅ guests only                                               |
| `claim_orders(uuid[])`         | ✅ `security definer`, bounded to 20, `authenticated` only   |
| `ordersService.claimOrders`    | ✅                                                           |
| httpOnly cookie helpers        | ✅ `lib/orders/claim-cookie.ts`, 30 days, defensive parse    |
| `claimPendingOrders()`         | ✅ never throws — a failed claim must not break verification |
| Hooked into email verification | ✅ `/auth/callback`, after the code exchange                 |
| Hooked into sign-in            | ✅ so "Maybe later" then signing in a week later still works |
| `placeOrder` stores the token  | ✅ cookie only, never returned to the browser                |

### Verified

`npm run verify` passes: **140 assertions** (up from 126) and a production build.
Eleven are this feature, and they include the attacks it exists to refuse:

| Assertion                                                     | Result    |
| ------------------------------------------------------------- | --------- |
| a guest order is issued a claim token                         | ✅        |
| **a stranger with a guessed token claims nothing**            | claimed 0 |
| the order is still unowned after a failed claim               | ✅        |
| holding the token claims exactly one order                    | claimed 1 |
| the order moved to the new account                            | ✅        |
| **the reference did not change — moved, not copied**          | ✅        |
| **no duplicate order was created**                            | ✅        |
| the token is spent on use                                     | ✅        |
| replaying a spent token claims nothing                        | claimed 0 |
| **a spent token cannot move an owned order to somebody else** | ✅        |
| an order placed while signed in gets no token                 | ✅        |
| an anonymous caller cannot claim                              | ✅        |
| the claimed order is readable by its new owner under RLS      | 1 row     |

### Not built — the screens

The flow the brief asks to verify **cannot be walked in a browser**, because it
starts at a checkout that does not exist. Outstanding, all of it UI over
mechanisms that are already in place:

- **`/checkout`** — the cart provider is still unmounted with no consumers
  (**D-30**), so there is nothing to check out
- **`/checkout/success`** and the account invitation with its two buttons
- **Registration pre-fill** from the checkout details. The order row holds the
  name, phone, telegram and address; the sign-up form does not read them yet
- **`/account/orders`** and the order detail view — `listMyOrders` exists and is
  RLS-scoped, nothing renders it
- **"Leave a review"** on a delivered order — the gate is enforced (ADR-66) and
  `listReviewableProducts` exists, no form renders it
- **Wishlist page** — `wishlists` has existed since Phase 2, unrendered

Tracked with the rest of the order UI as **D-31**.

> One thing the brief asked for that the schema does not carry: a **secondary
> phone number**. `orders` has one `phone`, required, plus an optional
> `telegram`. Adding a second is a migration and a form field; it was not
> invented here because a column nothing writes is worse than an absent one.

---

## Order ownership and the customer experience

🟢 **Complete through the customer flow.** Guest checkout, confirmation, order
history and the ownership hierarchy all exist and are verified.

### Ownership hierarchy — three paths, ranked by proof

An order gets an owner in exactly one of three ways, and they are ordered by how
strong the evidence is. Nothing else moves ownership.

| #   | Path                        | Proof it demands                                                                                                        | Where                          |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | **Claim token** (ADR-70)    | The caller _is the browser that placed the order_ — an unguessable, single-use capability that never leaves the server  | `claim_orders(uuid[])`         |
| 2   | **Verified email** (ADR-71) | The caller _controls the mailbox the order was placed with_ — Supabase confirmed it, and the guest typed it at checkout | `claim_orders_by_email()`      |
| 3   | **An administrator**        | None automatic. A human verified it out of band and is named in the audit log                                           | `admin_link_order(uuid, uuid)` |

**Token is tried first**, always, even when both would match — a capability
beats a typed address. The email path runs afterwards for anything left, which
is what covers the customer who ordered on a phone and registered on a laptop.

**Never ownership paths, and never will be:** phone number and order reference.
Neither is secret. A phone number is on a business card; `BND-001042` is
sequential so a manager can read it down the phone. Rejected in ADR-70 and the
reasoning has not changed.

### Security model

| Rule                                     | How it holds                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim tokens are never exposed           | httpOnly cookie; never in a URL, a response body or a log. `placeOrder` stores it server-side and returns only the reference                                           |
| An unverified account claims nothing     | `claim_orders_by_email` reads `auth.users.email_confirmed_at` **at call time** rather than trusting a JWT claim issued earlier                                         |
| No path overwrites an existing owner     | Every one matches `user_id is null`. An administrator cannot reassign either                                                                                           |
| A spent token is dead                    | Claiming nulls it; replay matches nothing                                                                                                                              |
| One customer cannot take another's order | Asserted directly: a stranger with a guessed token, a second verified account on the same address, and an administrator attempting reassignment all claim **0**        |
| Every ownership change is logged         | All three paths call `log_order_ownership`, which writes an append-only `audit_logs` row recording the method and the actor. Immutable even to `service_role` (ADR-27) |

The email column is **optional and stays optional**. Checkout does not require
an address and must not start: this shop rings people, and a required field
nobody reads costs orders.

### Status workflow

Seven statuses; six form the pipeline and `cancelled` leaves it.

| Status      | What it means                                                                        |
| ----------- | ------------------------------------------------------------------------------------ |
| `new`       | Submitted. Nobody has rung yet                                                       |
| `contacted` | A salesperson is reaching the customer to confirm details, availability and delivery |
| `confirmed` | The customer agreed. Approved for building                                           |
| `preparing` | Being assembled, tested and packed                                                   |
| `shipped`   | It has left the shop                                                                 |
| `delivered` | Received. **Reviews unlock here**                                                    |
| `cancelled` | Will not be fulfilled. Terminal, reachable from anywhere                             |

> **The enum kept `contacted` rather than becoming
> `awaiting_customer_confirmation`** — a decision taken explicitly rather than by
> omission. The label and its one-line explanation already say exactly what the
> longer name describes ("Menejerimiz siz bilan bog'lanmoqda" / "Менеджер уже
> связывается с вами" / "One of our team is getting in touch"), and renaming an
> enum in a live database to restate copy is churn without a reader who benefits.

The customer timeline draws the six pipeline steps with completed, current and
upcoming states, and a sentence under the current one. A cancelled order gets
**no timeline at all** rather than a broken one: five greyed steps under a red
banner reads as "still in progress", which is the opposite of true.

### Built

| Piece                   | State                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `/checkout`             | ✅ guest-only, delivery or pickup, all fields incl. optional email |
| `/checkout/success`     | ✅ renders from the query string, fetches nothing                  |
| Account invitation      | ✅ shown only when a claim is pending; two equal buttons           |
| `/account/orders`       | ✅ RLS-scoped history                                              |
| `/account/orders/[id]`  | ✅ timeline, items, totals, delivery, contact                      |
| Review gating           | ✅ `delivered` only, enforced by RLS underneath                    |
| Basket                  | ✅ provider mounted, add control, sheet with quantities            |
| `claim_orders_by_email` | ✅ service + wired into every session start                        |
| `admin_link_order`      | ✅ function + service. **No UI** — see below                       |

### Not built

- **The admin "Link Order to Customer" button**, and the admin orders module it
  would live in. The function, its permission check and its audit row are done
  and asserted; there is no `/admin/orders` screen to put a button on, and the
  module is held out of the registry so the sidebar cannot link to a 404 (D-31).
- **Registration pre-fill** from the order — the `?from=order` link exists, the
  sign-up form does not read it yet.
- **The review form.** Gating works; the form does not exist.
- **Admin guest-vs-registered badge** — same blocker as the manual link.

### Verified

`npm run verify` passes: **162 assertions** and a production build.

| Assertion                                                                    | Result                |
| ---------------------------------------------------------------------------- | --------------------- |
| ADR-70 still works: the token claims its order                               | claimed 1             |
| a token claim writes an audit row                                            | ✅                    |
| **an unverified account claims nothing by email**                            | claimed 0             |
| **a verified account with a different address claims nothing**               | claimed 0             |
| a verified email claims every eligible order                                 | claimed 2             |
| each email claim writes an audit row                                         | ✅                    |
| references unchanged — rows moved, nothing copied                            | ✅                    |
| re-running the email claim claims nothing                                    | claimed 0             |
| **a second verified account on the same address cannot take an owned order** | claimed 0             |
| a customer cannot link an order by hand                                      | refused               |
| an administrator can link an unowned order                                   | ✅                    |
| the audit row names the administrator as actor                               | `method=admin_manual` |
| **an administrator cannot reassign an owned order**                          | ✅                    |
| a cancelled order earns no review                                            | ✅                    |
| a delivered order earns a review                                             | ✅                    |
| checkout fields round-trip; a pickup with no shop is refused                 | ✅                    |

> **Not walked in a browser.** The hosted project does not have the last two
> migrations, and the catalog has no products, so there is nothing to put in a
> basket. Everything above is proven by assertions against a real Postgres, plus
> typecheck and build — not by clicking through it.

---

## Admin panel — live database connection

🟡 **The data path is proven live. One module is wired to it; the rest are not.**

### What was actually verified, against the hosted project

`npm run admin:verify` (`scripts/verify-admin-crud.mjs`) mints a throwaway
administrator, signs in **with the public anon key**, and does every write
through that RLS-enforced session before cleaning up after itself.

That distinction is the point. A service-role script proves the schema accepts a
row and nothing else; the layer most likely to refuse an admin write is
`has_permission()`, and bypassing RLS is exactly how you fail to notice.

**23/23 passed** against `pgxqnezwrwfgrmamlxhs`:

| Layer      | Assertion                                                                      | Result            |
| ---------- | ------------------------------------------------------------------------------ | ----------------- |
| Auth       | an administrator can sign in                                                   | ✅                |
| RLS        | `has_permission('products.create')` resolves                                   | `true`            |
| Brands     | create · read · update · soft delete                                           | ✅ ✅ ✅ ✅       |
| Categories | create · 3 translations · read · update translation · soft delete              | ✅ ✅ ✅ ✅ ✅    |
| Products   | create · 3 translations · read · update price+featured · publish · soft delete | ✅ ✅ ✅ ✅ ✅ ✅ |
| Storefront | anonymous read of the published product                                        | ✅ sees it        |
| Storefront | anonymous read after reverting to draft                                        | ✅ hidden         |
| Storage    | upload a PNG to the `products` bucket                                          | ✅                |
| Storage    | the uploaded file is publicly readable                                         | HTTP 200          |
| History    | soft delete keeps the row                                                      | ✅                |
| **RLS**    | **a signed-in customer cannot create a brand**                                 | refused, `42501`  |

So the chain **client → RLS → database → Storage** works, for all three
resources, in both directions. Nothing in that list is a fixture.

### What is wired to it

| Module                                               | State                                                                                                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brands**                                           | ✅ **Live.** The page reads `brands` + real product counts; the manager's save and delete call `saveBrand` / `deleteBrand`, which call the services. No local list state — the action revalidates and the server returns the row |
| Products                                             | ❌ still `mocks/admin`                                                                                                                                                                                                           |
| Categories                                           | ❌ still `mocks/catalog`                                                                                                                                                                                                         |
| Inventory, content, homepage, settings, users, audit | ❌ still `mocks/admin`                                                                                                                                                                                                           |

`actions/catalog.actions.ts` exists and covers **all three** resources —
`saveBrand`, `deleteBrand`, `saveCategory`, `deleteCategory`,
`reorderCategories`, `saveProduct`, `deleteProduct` — each Zod-validated,
permission-guarded and revalidating the storefront. Products and categories are
one manager rewrite away, not one architecture away.

### Two things the mock layer was hiding

Removing it from brands surfaced fields that had **no column behind them**:

- `website` was fabricated from the slug (`https://www.${slug}.com`). The real
  column is `website_url` and was usually null.
- `isFeatured` was "the first four rows".
- A localized **description** input existed on the dialog and wrote nowhere — a
  brand's prose lives in `brand_translations`, and the form never sent it. It is
  removed rather than left silently discarding what an operator types.

That is the class of bug ADR-20 and § 12 exist to prevent, and it was invisible
while the screen rendered fixtures.

### The banner

It said "sample data mode is enabled — changes will not be saved". That is now
false for brands and true for everything else, so it says which is which rather
than one blanket claim that is wrong either way. It comes out entirely when the
last module is wired.

### Not done

- **Products and categories managers** — the actions and services are ready; the
  two client components (639 and 252 lines) still hold mock-shaped state.
- **Image upload from the admin UI.** Storage is proven working from a script;
  `ModuleMediaManager` still does not call it.
- Inventory, content, homepage, settings, users, audit modules.

---

## Admin panel — module connection status

**Five of eleven modules write to the live database; one more is real read-only.**
This table is the truth; anything that says "the admin is connected" without
qualifying it is wrong. It is also **declared in code** — `persistence` on each
record in `lib/admin/modules.ts` (**ADR-80**) — so the in-panel banner names
exactly the fixture rows below and nothing else.

| Module         | Persistence  | CRUD verified                                    | Remaining mock code |
| -------------- | ------------ | ------------------------------------------------ | ------------------- |
| **Products**   | ✅ live      | ✅ live, incl. images, specs, publish, restore   | none                |
| **Categories** | ✅ live      | ✅ live — tree, drag & drop, icons, images, SEO  | none                |
| **Brands**     | ✅ live      | ✅ live, **create added this pass**              | none                |
| **Highlights** | ✅ live      | ✅ live                                          | none                |
| **Dashboard**  | ✅ live      | ✅ live reads                                    | none                |
| **Audit**      | ✅ read-only | ✅ live read                                     | none                |
| **Inventory**  | ✅ live      | ✅ live — movement, trigger, threshold, refusal  | none                |
| **Homepage**   | ✅ live      | ✅ live — banner CRUD, activate, anonymous read  | none                |
| **Content**    | ✅ live      | ✅ live — create, translate, publish, delete     | none                |
| **Users**      | ✅ live      | ✅ live — job title, role grant/revoke, disable  | none                |
| **Settings**   | ✅ live      | ✅ live — value, localized value, anonymous read | none                |

The command palette reads products, categories, brands **and content pages**
from the database. `mocks/admin.ts` is deleted: it had no importers left.

**The "partly connected" banner is gone**, and it was not removed by hand. It is
derived from `persistence` in the registry (ADR-80), so emptying the fixture
list is what removed it — the banner cannot now reappear without a module
declaring itself unfinished, and cannot be silenced without one becoming real.

### Resolved: the two blockers named here

- **Homepage sections had no table — and still do not, deliberately.** The
  section editor is _removed_ rather than persisted. The home page composes its
  rails from the category tree and orders them by `categories.display_order`
  (ADR-75), which an operator already controls in `/admin/categories`; a
  `homepage_sections` table would have been a schema nothing reads, which is
  the same lie as the fixture with a migration attached. `site_banners` is the
  part that has a table, and it is now fully editable.
- **Users has a service now** — `services/users.service.ts`, over
  `admins` + `profiles` + `user_roles`, which is the staff list rather than the
  customer list. One limitation is structural and stated on screen: an email
  address lives in `auth.users`, which PostgREST does not expose and no RLS
  policy can grant, so reading it would need the service role. The team screen
  identifies people by name and job title instead (**D-31**).

### What was verified live this pass

`npm run admin:verify` — **23/23** against `pgxqnezwrwfgrmamlxhs`, signed in as
a throwaway administrator through the **anon key**, so every write goes through
RLS rather than around it. Covers brand, category and product create · read ·
update · soft delete, translation rows in three locales, publishing, an
anonymous storefront read that sees a published product and does not see a
draft, a PNG uploaded to the `products` bucket and fetched back at HTTP 200,
and a customer refused a brand insert with `42501`.

### Categories, this pass

The manager was rebuilt around the database's shape:

- **Keyed by `id`, not `slug`.** The mock keyed on slug because a fixture's slug
  never changed; a real one is editable, and keying a list on a field the form
  can edit is how a row loses its identity mid-edit.
- **The slug is localized.** It was a single `<Input>` that could only ever have
  written one language — `category_translations.slug` is per locale (ADR-52), so
  it is now a `LocalizedField` like the name.
- **`icon` and `parentSlug` are gone.** Neither had a column. Parent is
  `parent_id`.
- **The list is no longer local state.** Reordering, saving and deleting call the
  actions, which revalidate; the server sends the rows back.

### Audit, this pass

Reads `audit_logs`. The **summary column was removed** rather than reproduced:
there is no such column and there should not be. An audit row records what
happened in machine terms — action, resource, actor, timestamp — and prose about
it would be a second, editorialised copy of the same fact. `ACTION_TONE` became
a partial lookup with a fallback, because `action` is free text, so an action a
future migration writes renders neutrally instead of crashing the table.

---

## The category system

🟢 **Complete end to end** — schema, taxonomy, services, actions, mega menu,
mobile accordion and a full admin module. Verified against the live project and
driven in a real browser.

**Nothing about a category is hardcoded anywhere.** The twelve departments and
their ninety subcategories are rows. Every name, slug, description, icon, image,
SEO field, position, parent and visibility flag is editable from
`/admin/categories` without a deploy. There is no category list in any component,
message file or constant — `CATEGORY_ICONS` is the only category-adjacent
constant and it is a set of _glyphs_, not of categories.

### The taxonomy

`20260815001000_category_taxonomy.sql` (**ADR-72**, superseding ADR-68) ships
102 categories in uz/ru/en with a slug per locale:

| #   | Department (uz / ru / en)                                      | Icon         | Subcategories |
| --- | -------------------------------------------------------------- | ------------ | ------------- |
| 1   | Tayyor kompyuterlar / Готовые компьютеры / Computer builds     | `PcCase`     | 6             |
| 2   | Noutbuklar / Ноутбуки / Laptops                                | `Laptop`     | 8             |
| 3   | Monobloklar / Моноблоки / All-in-one PCs                       | `Computer`   | 3             |
| 4   | Monitorlar / Мониторы / Monitors                               | `Monitor`    | 5             |
| 5   | Butlovchi qismlar / Комплектующие / PC components              | `Cpu`        | 15            |
| 6   | Geymerlar uchun / Для геймеров / Gaming                        | `Gamepad2`   | 7             |
| 7   | Aksessuarlar / Аксессуары / Accessories                        | `Headphones` | 19            |
| 8   | Tarmoq uskunalari / Сетевое оборудование / Networking          | `Wifi`       | 8             |
| 9   | Printer va skanerlar / Принтеры и сканеры / Printers, scanners | `Printer`    | 8             |
| 10  | Xotira qurilmalari / Накопители / Storage                      | `HardDrive`  | 6             |
| 11  | Dasturiy ta'minot / Программное обеспечение / Software         | `Disc`       | 5             |
| 12  | Boshqa mahsulotlar / Прочие товары / Other                     | `Package`    | 0 — by design |

Written three times from the business meaning rather than translated once
(CLAUDE.md § 11a): `Videokartalar` / `Видеокарты` / `Graphics cards`,
`Quvvat bloklari` / `Блоки питания` / `Power supplies`. Protected names do not
move in any language — SSD, HDD, NAS, USB, HDMI, DisplayPort, VGA, LAN, Wi-Fi,
Bluetooth, RGB, MacBook, Windows, Microsoft Office.

**Two levels is the data, not the limit.** `parent_id`, the trigger-maintained
`path`, the cycle rejection and the descendant rebuild have supported unlimited
depth since Phase 2, and `db:verify` asserts a third level inserts at depth 2 and
that a cycle is still refused at any depth. The tree builder, the mega menu, the
mobile accordion and the admin tree are all recursive and none of them knows the
current depth.

### Depth is free: two queries for the whole navigation

| Cost                    | What pays it                                                          |
| ----------------------- | --------------------------------------------------------------------- |
| Categories + all copy   | **1** request — `listCategories` embeds `category_translations`       |
| Product counts          | **1** request — tallied in memory, then rolled up the `path`          |
| Nesting                 | **0** — `toCategoryTree` folds the flat list in one pass              |
| Per-locale slug         | **0** — resolved server-side from the rows already fetched            |
| Header + footer + menus | **0 extra** — the layout fetches once and hands the tree to all three |

`cache()` deduplicates within a request, so a page that also wants the tree pays
nothing. It is per-request memoisation and deliberately not a cross-request
cache: which categories a caller may see depends on their RLS session (ADR-12).

### Two bugs this surfaced

**Ordering by `path` sorts by random UUIDs.** `listCategories` ordered by
`(path, display_order)`, and `path` is a `uuid[]`. That was invisible while the
taxonomy was a flat list nobody had arranged; the moment the twelve departments
had a business order the header rendered them shuffled — Storage first, Computer
builds seventh. Now `(depth, display_order)`, which gives the one guarantee
`path` was needed for (parents before children) plus the only ordering an
operator actually sets. **Caught by reading the rendered menu, not by review.**

**A department listing showed nothing** (**ADR-74**). Products are filed against
a leaf, so filtering by a department's own id matched zero rows and all twelve
top-level links led to an empty shop. `listProducts` now resolves the subtree
from `path` and filters with `in`.

### The admin module

`/admin/categories` — a real tree, not a flat list:

| Capability           | How                                                                        |
| -------------------- | -------------------------------------------------------------------------- |
| Create / subcategory | New at the top level, or `+` on any row to create beneath it               |
| Change parent        | A select excluding self and descendants, **and** drag-into-row             |
| Drag & drop ordering | Insert line between rows, drop-into-row to re-parent, tail target for last |
| Keyboard equivalent  | Up · Down · Indent · Outdent on every row — WCAG 2.2 SC 2.5.7              |
| Hide / show          | One click in the list; its own action, so it cannot blank the copy         |
| Featured             | Toggle in the Publish section; drives the "Popular" row in the mega menu   |
| Icon                 | 30-glyph picker, radiogroup semantics with arrow keys                      |
| Image                | Upload to `site-assets`, preview, replace, remove                          |
| Translations         | Name, slug and description in uz/ru/en with coverage badges                |
| SEO                  | The shared `ModuleSeoPanel` — meta, keywords, canonical, OG, card type     |
| Delete               | Refused while the category has live children, with a sentence saying so    |

**The image uploader is the first control in the admin that actually reaches
Storage.** `ModuleMediaManager` has existed since Phase 3D and uploads nothing
(**D-12**); this does not replace it — a category has one image, not a gallery.
Uploading returns a path and does **not** save: the operator's Save writes
`image_path`, so an abandoned form leaves the category untouched. The cost is an
orphaned object, which is the cheaper mistake than putting a mis-picked image on
the storefront before anyone agreed to it.

### Verified

| Layer                      | Evidence                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run verify`           | passes — **175 schema assertions** + production build                                                            |
| Migration on the project   | `supabase db push` applied it to `pgxqnezwrwfgrmamlxhs`; **22 migrations** local and remote in lockstep          |
| Live, through the anon key | 102 categories, 12 departments, 90 children, all three languages each, per-locale slugs, one request             |
| `npm run admin:verify`     | **36/36** through an RLS-enforced admin session (up from 23)                                                     |
| Nesting live               | subcategory created at depth 1 with a two-element path; re-parented to root and back; **a cycle refused, 23514** |
| Icon validation live       | `Cpu` accepted, `../evil.svg` refused by the check constraint                                                    |
| SEO live                   | three locales with distinct slugs, OG title and `twitter_card` written and read back                             |
| Visibility live            | hidden by the admin; absent from the anonymous storefront read; shown again                                      |
| Desktop mega menu          | 12 departments in business order, panel 960×498, department switch renders 15 subcategories, **0 overflow**      |
| Mobile accordion at 375px  | 12 top-level, 11 disclosures all closed, 113 rows, **0 rows under 40px**, 0 overflow, nesting expands            |
| Server HTML                | **114 category links** in the header markup before any JavaScript runs                                           |
| All three languages        | uz/ru/en department lists correct; every link locale-prefixed; `/ru/...=gotovye-kompyutery`                      |
| Admin screen in a browser  | 102 draggable rows, 12 top-level, 204 indent/outdent buttons, 30 icon options, `PcCase` preselected from the row |
| A write from the UI        | visibility toggled in the browser → read back from the live database → toggled back and re-read                  |

**Measured, not claimed:** the admin list takes **~7s** to reflect a write in the
dev server. The write itself is immediate — the database was read back to confirm
it — and the delay is `router.refresh()` re-rendering a 102-row tree under
Turbopack with a full layout revalidation. It has **not** been re-measured against
a production build. Recorded as **D-32**.

---

## Business-information pages

🟢 **Live in three languages, from the database.** Delivery, warranty, returns,
contact and about — the pages the footer has been unable to link since Phase 3A,
because `content_pages` existed and held no rows.

| Page     | Path        | Content source                          |
| -------- | ----------- | --------------------------------------- |
| Delivery | `/delivery` | `content_pages` row, uz/ru/en           |
| Warranty | `/warranty` | `content_pages` row, uz/ru/en           |
| Returns  | `/returns`  | `content_pages` row, uz/ru/en           |
| Contact  | `/contact`  | row **plus** `settings` for the details |
| About    | `/about`    | `content_pages` row, uz/ru/en           |

**No copy is hardcoded in a component.** The body of every page is a
`content_page_translations` row shipped by
`20260817001000_business_information_pages.sql`, editable from the admin without
a deploy. What lives in `messages/info.json` is chrome — "Need a hand?", the
field labels on the contact card — which is ADR-39 applied exactly as written.

### What the business gave, and what it did not

Everything published is the business's own information: the carriers (BTS, EMU,
UzPost and whatever else serves the address), the 24-hour preparation window, the
three-day delivery estimate, that delivery is charged separately and quoted on
the confirmation call (ADR-63), that PCs are assembled in house, and the
**one-year** warranty.

Nothing else was written. Specifically:

- **The returns page states that the policy is not finalised** and asks the
  customer to get in touch. No window, no refund terms.
- **The warranty page gives the term and says the detailed conditions are not
  published yet.** No exclusions were invented.
- **Privacy and terms do not exist** — no row, no route, no footer link
  (**ADR-77**).
- **The contact card renders only configured settings.** All five —
  `store.phone`, `store.telegram`, `store.support_email`, `store.address`,
  `store.hours` — are **null**, so the card says so in the visitor's language and
  shows no number, no address and no hours. Verified both ways: with a value set
  it rendered exactly that one field as a `tel:` link and left the other four
  absent; the value was then reverted to null, because it was a test value and
  not the shop's.

### Three languages, written three times

Uzbek first, then Russian and English from the same facts rather than from the
Uzbek. The section counts differ (delivery is 7 sections in Uzbek and 6 in
English), the headings differ, and the carrier list is a bulleted list in Uzbek
and a sentence in Russian — which is what independent writing produces and
translation does not.

### A latent bug this surfaced

**`checkout` and `adminHighlights` had never been loaded.** `i18n/messages.ts`
enumerates the namespaces it imports and `scripts/check-translations.mjs` walked
the `messages/` directory — two lists, and they had drifted. Both namespaces had
all three locale files, so every translation check passed, while
`useTranslations("checkout")` threw `MISSING_MESSAGE` and **`/checkout` answered
500**. It went unnoticed because the route is behind a redirect and nothing had
opened it in a browser since it was written.

Found because `info` failed the same way and the same minute. All three are now
in the loader, and the checker asserts the two lists agree in both directions —
verified by removing `checkout` from the list and watching the check fail.

### Verified

| Check                                    | Result                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `npm run verify`                         | passes — 175 schema assertions + build, **94 static routes** (79) |
| 15 URLs (5 pages × 3 locales)            | **all 200**, production build                                     |
| Untranslated keys in the production HTML | **0** across all 15                                               |
| Raw `##` or `- ` markup leaking          | **0** — the parser renders headings and lists as elements         |
| Three-year warranty claims               | **0**                                                             |
| Invented return windows (7/14/30 days)   | **0**                                                             |
| `tel:` / `mailto:` links                 | **0** — nothing is configured, so nothing is linked               |
| Lifetime / free-repair claims            | **0**                                                             |
| Footer links, all locales                | 18 × 200, 6 × 307 (the account links, correctly gated)            |
| Language switch on a content page        | `/uz/returns` → `/ru/returns`, heading follows                    |
| Mobile 375px                             | 0 overflow; aside drops below the copy; `h1` 24px                 |
| Desktop 1280px                           | content column 1120px, footer 314px, 0 overflow                   |

**Not verified:** 390 / 768 / 1024 / 1440 / 1920 on the new pages specifically.
The layout is a single `max-w-[1120px]` container with one `lg:` breakpoint, and
375 and 1280 were both measured — but the intermediate widths were not opened.

---

## The catalog listing

🟢 **Rebuilt around an information architecture rather than a row of chips.**

The listing used to render one filter chip per category — every level in
identical pills, above every result. Capping it at twelve departments fixed the
height; it did not fix the fact that nothing on the page told a shopper which
level they were looking at. Four levels now look like four levels:

| Level       | Component        | Treatment                                          |
| ----------- | ---------------- | -------------------------------------------------- |
| Department  | `CategoryNav`    | Bordered chips with icons, one active              |
| Subcategory | `SubcategoryNav` | Lighter text links — **only when in a department** |
| Filter      | `CatalogFilters` | A sidebar, or a sheet on a phone                   |
| Product     | `ProductGrid`    | The grid                                           |

**Desktop:** five departments inline, the remaining seven behind a "Yana / Ещё /
More" disclosure, so the row stays one line at every width. The disclosure is
`<details>` — no JavaScript, keyboard operable, announced without ARIA — which is
what keeps the primary navigation server-rendered. The trade is that it does not
close on outside click or Escape; for a list of links, where the next click
navigates anyway, that is cheaper than making navigation depend on hydration.

**Mobile:** all twelve in a horizontal scroller that scrolls **inside itself**,
so the page never widens. The sidebar is not stacked above the products; the same
filter panel opens in a sheet from a `[Filtrlar]` button beside `[Saralash]`.

**Filters are not categories.** Price, brand and on-sale — each backed by a real
column (**ADR-79**). Availability and specification facets are deliberately
absent, and so is sorting by name; the reasons are in the ADR.

**The URL is the state** (**ADR-78**). `lib/catalog/search-params.ts` owns the
encoding, so the page reads `searchParams`, queries and renders — a Server
Component with two client islands. Every filter is shareable, bookmarkable and
survives the back button.

### Measured

| Metric                         | Before           | After                    |
| ------------------------------ | ---------------- | ------------------------ |
| Category navigation height     | 424px, 102 chips | **49px**, 12 departments |
| Nav + subcategory + breadcrumb | 424px            | **154px**                |
| Empty state height             | 294px            | **238px** (compact)      |
| Horizontal page overflow       | —                | **0** at 375 and 1280    |

### Verified

`npm run admin:verify` — **45/45** against the live project, up from 36. Nine are
new and prove the filters and sorts, through the **anon** client so RLS is in the
path: three throwaway products with known prices, brands and sale prices are
created, the queries the service issues are run against them, and they are
deleted in the `finally` block.

| Assertion                                         | Result                |
| ------------------------------------------------- | --------------------- |
| price range returns only what is inside it        | 1 of 3                |
| brand filter returns only that brand              | 1 of 3                |
| two brands return the union, not the intersection | 3 of 3                |
| the sale filter returns only discounted products  | 1 of 3                |
| price ascending                                   | 10000 < 50000 < 90000 |
| price descending                                  | 90000 > 50000 > 10000 |
| recommended puts the featured product first       | ✅                    |
| the listing count is exact, not estimated         | `count=3`             |

**Driven in a browser**, with three products and two brands temporarily inserted
and then removed:

- ticking a brand updated the URL, the count went 3 → 1, the grid showed only
  that brand, a removal chip and "Tozalash" appeared;
- `?sort=price-asc` ordered 549k → 899k → 1249k;
- brand checkboxes carried **real** per-brand counts (ASUS 2, Lenovo 1) and the
  price hint showed the catalog's actual range;
- the mobile sheet opened with focus inside it, 2-column grid, zero page
  overflow;
- 12 URLs across uz/ru/en returned **200** against the production build,
  including `?brand=nope&min=abc&page=-5`, which the parser discards rather than
  passing to the query.

**A defect this surfaced.** The filter panel renders twice — sidebar and sheet —
and both emitted the same element ids. Radix keeps sheet content mounted after
its first open, so once a shopper opened the drawer, `<Label htmlFor>` resolved
to the **first** match and a label tapped in the drawer toggled the checkbox
behind it in the sidebar. Fixed with `useId()`; the production HTML now has zero
duplicate ids.

**Not verified:** the listing has never been seen with more than three products,
so pagination beyond one page has not been exercised in a browser — only the
`pageCount` arithmetic and the `?page=` parser. 390 / 768 / 1024 / 1440 / 1920
were not opened on this page; 375 and 1280 were.

---

## The admin panel — Products connected

🟢 **Products, categories and brands all persist to the live database.** The
panel's P0 is done: an administrator signs in, creates a product, uploads an
image, publishes it, and a shopper sees it.

### Root cause of "Qisman ulangan"

Three separate things, not one:

1. **`components/admin/layout/admin-shell.tsx` rendered the banner
   unconditionally**, with a hand-written sentence naming brands as the only
   connected module. It could not be right for long and was not.
2. **Seven controls called a `notSaved()` helper** that raised a toast and wrote
   nothing — the product table's publish, unpublish, feature, delete and
   duplicate, and the product form's submit.
3. **The product pages read `mocks/admin` and `mocks/catalog`.** The editor was
   bound to `AdminProduct`, a type built on the storefront's `Product` carrying
   `rating`, `stock` and `badges` — fields no administrator can write. That is
   **D-29** and the same class as **K-15**: a form designed against an imagined
   schema.

The banner is now derived from `persistence` on each registry record
(**ADR-80**), so it names only the modules still on fixtures and disappears
when the last one lands.

### What was connected

| Piece               | How                                                                 |
| ------------------- | ------------------------------------------------------------------- |
| Product list        | `listProducts`, all statuses, real counts                           |
| Product editor      | `AdminProductDraft` — every field a column; `saveProduct` on submit |
| Publish / unpublish | `saveProduct`, from the list row menu and the editor                |
| Delete / restore    | `deleteProduct` (soft) + **new** `restoreProduct`                   |
| Specifications      | **new** on `saveProduct`, via `replaceSpecifications`               |
| Images              | **new** upload / delete / primary / reorder actions over Storage    |
| Brand create        | **new** — the manager had edit and delete but no way to add one     |
| Command palette     | products, categories and brands from the database                   |

### Two real bugs this surfaced

**`assertPublishable` ran on every save, not just a publish.** It demanded a
price, a category and a brand before any write, so a product could not be
created at all — the first Save of a new product failed with "This product is
not ready to publish." A draft is allowed to be incomplete; that is what draft
means. The guard now returns early unless `status = 'active'`, and its message
names what is missing.

**`getProductById` filtered out soft-deleted rows**, so a deleted product could
not be opened and `restoreProduct` was unreachable from the only screen that
offers it. It now takes `includeDeleted`, which the admin editor passes and the
storefront does not.

### Verified live — `npm run admin:verify`, 61/61

Up from 45. Every write goes through an RLS-enforced administrator session
signed in with the **public anon key**, and everything is deleted afterwards.

| Area           | Assertions                                                                             |
| -------------- | -------------------------------------------------------------------------------------- |
| Products       | create · read · update · translations · publish · unpublish · **restore**              |
| Specifications | insert, then **replace not append** (3 rows → 1)                                       |
| Images         | upload to Storage · row written · primary · **exactly one primary** · reorder · delete |
| Storefront     | published product **and its 2 images** visible anonymously; draft invisible            |
| Categories     | create · translations · subcategory · re-parent · cycle refused · reorder · delete     |
| Brands         | create · read · update · soft delete                                                   |
| Authorization  | customer refused product / category / brand insert and publish — all `42501`           |
| Authorization  | **anonymous** refused product / category / brand / image insert — all `42501`          |

### Verified in a browser

Signed in as a throwaway super-admin against the live project, dev server:

| Step                                                        | Result                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Create product from the form (name ×3, slug ×3, SKU, price) | row in the database, draft/hidden                                 |
| Product list                                                | "Katalogda 1 ta mahsulot", real row                               |
| Edit price 1250 → 999, save, **refresh**                    | **999 persisted**                                                 |
| Upload PNG through the form                                 | object in Storage + `product_images` row                          |
| **Refresh**                                                 | image still there, marked primary                                 |
| Category and brand selects                                  | 103 real categories, the brand just created                       |
| Publish (active + public)                                   | anonymous `/uz/products?category=…` **shows it**, detail page 200 |
| Unpublish from the list row menu                            | anonymous listing **0 hits**                                      |
| Brand: create → refresh                                     | persisted                                                         |
| Category: create → refresh                                  | persisted, 103 categories                                         |

All test data was removed afterwards; the project is back to 0 products, 0
brands, 102 categories.

### Still not connected, and honestly so

Inventory, homepage, content pages, users and settings remain on fixtures and
say so in the banner. **Variants** were removed from the product editor rather
than left rendering a form that saves nothing — the schema and
`services/variants.service.ts` exist, the Server Actions do not (**D-34**).

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
