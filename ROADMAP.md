# Roadmap

Nine phases from foundation to launch. Current state always lives in
[PROJECT_STATUS.md](PROJECT_STATUS.md) — this file is the plan, that file is the
truth.

**Current position:** Phase 3A complete, plus internationalization (uz/ru/en)
delivered as a cross-cutting change. Phase 3B is next, gated on **K-3**.

**Internationalization is not a phase.** It moved out of "explicitly out of
scope" and into every phase: from now on a feature is not complete until Uzbek,
Russian and English all exist for it, enforced by `npm run check`. See
[CLAUDE.md § 11](CLAUDE.md#11-internationalization-policy).

**Overall progress:** ~48%

```
Phase 1  Foundation                ████████████████████ 100%   ✅ complete
Phase 2  Database Foundation       ████████████████████ 100%   ✅ complete (K-3 open)
Phase 3A Premium UI (mock data)    ████████████████████ 100%   ✅ complete
         Internationalization      ████████████████████ 100%   ✅ complete (uz/ru/en)
         Admin panel (mock data)   ████████████████████ 100%   ✅ complete — out of order, ADR-46
Phase 3B Storefront Data Wiring    ░░░░░░░░░░░░░░░░░░░░   0%   ← next (needs K-3)
Phase 4  Cart & Checkout           ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5  Customer Accounts         ░░░░░░░░░░░░░░░░░░░░   0%
Phase 6  Admin — data + auth       ░░░░░░░░░░░░░░░░░░░░   0%   (UI done; needs services, auth, orders)
Phase 7  Commerce Features         ░░░░░░░░░░░░░░░░░░░░   0%
Phase 8  Operations                ░░░░░░░░░░░░░░░░░░░░   0%
Phase 9  Production Hardening      ░░░░░░░░░░░░░░░░░░░░   0%
```

Phases are weighted by expected effort, not counted equally — Phase 1 is small
and Phase 4 is large. The percentage is an estimate and gets revised as phases
land.

---

## How phases work

- **One phase at a time.** A phase is not started until the previous one is
  reviewed and signed off.
- **Each phase ends with a review** in the style of the Phase 1 review: read the
  code critically, assume nothing is correct, fix what is found, then report.
- **Each phase then closes out under the release policy** — the nine mandatory
  steps in [CLAUDE.md § 10](CLAUDE.md#10-release-policy): verify, update the
  three documents, commit conventionally, tag when instructed, push, verify the
  remote, and do not start the next phase until GitHub is synchronised. That
  section is authoritative; this list does not restate it.
- **Each phase bumps the minor version** and gets a `CHANGELOG.md` entry.
- **`PROJECT_STATUS.md` is updated after every completed task**, not just at the
  end of a phase.
- Ordering is a dependency chain, not a preference. Phase 3 cannot start without
  a schema; Phase 6 cannot start without roles.

---

## Phase 1 — Foundation ✅

**Status:** Complete · **Version:** v0.1.0 · **Reviewed:** yes

Toolchain, architectural boundaries, Supabase integration layer. No features.

- [x] Next.js 15 App Router + React 19 + TypeScript strict
- [x] Tailwind CSS 4 + shadcn/ui
- [x] ESLint 9 flat config + Prettier 3, unified as `npm run check`
- [x] Layer structure with written contracts (`actions/`, `services/` READMEs)
- [x] `lib/env.ts` — Zod-validated environment contract
- [x] `lib/routes.ts`, `errors.ts`, `result.ts`, `logger.ts`, `site-config.ts`
- [x] Four Supabase clients with documented trust levels
- [x] Middleware session refresh + protected-route redirect
- [x] Home page, 404, root layout, route + root-layout error boundaries
- [x] Header and footer placeholders
- [x] Security headers
- [x] Supabase CLI project initialised
- [x] Architectural review — 14 issues found and fixed

**Exit criteria met:** `npm run check` passes, production build passes, runtime
behaviour verified in a browser, First Load JS at 131 kB.

---

## Phase 2 — Database Foundation ✅

**Status:** Complete · **Target version:** v0.2.0 · **Reviewed:** yes

> **Scope changed during this phase.** It was planned as "Database &
> Authorization" and included the sign-in/sign-up flow and the first services.
> The Phase 2 brief scoped it to the database platform only — no UI, no
> services. Those items moved to Phase 3 rather than being dropped, and **K-2
> stays open** as a result. `product_variants` was also dropped from the
> schema; see **D-8**.

### Schema

- [x] `profiles` — 1:1 with `auth.users`, created by trigger on signup
- [x] `roles`, `permissions`, `role_permissions`, `user_roles`, `admins`
- [x] `brands`, `categories` (unlimited depth, cycle-rejecting), `products`
- [x] `product_images`, `product_specifications` — both unlimited per product
- [x] `inventory` + `inventory_movements` — append-only ledger
- [x] `settings`, `site_banners`, `audit_logs`, `wishlists`, `wishlist_items`
- [x] UUID keys, `created_at`/`updated_at`, `created_by`/`updated_by`, soft
      delete where a row is referenced by history
- [x] Weighted `tsvector` generated column + GIN; trigram index for fuzzy SKU
- [x] 58 indexes, each with a written justification

### Security

- [x] RLS enabled on all 18 tables, in the migration that creates each
- [x] 45 policies on `public`, 10 on `storage.objects`
- [x] Anonymous: published products, visible catalog metadata, public settings
- [x] Customers: own profile and own wishlists only
- [x] Admins: permission-gated through `has_permission()`
- [x] Every `SECURITY DEFINER` function pins `search_path` — verified
- [x] Explicit least-privilege GRANTs rather than platform defaults
- [x] Storage bucket policies; `avatars` private and owner-folder-scoped

### Storage and data

- [x] Buckets: `products`, `brands`, `avatars`, `banners`, `site-assets`
- [x] Development seed that aborts on a non-empty database
- [ ] **`npm run db:types` — blocked, needs Docker (K-3)**

**Exit criteria:** met except generated types. Every table has RLS with explicit
policies; all 9 migrations plus the seed apply cleanly to a real Postgres engine
under 116 assertions; `npm run verify` passes. `db:reset` against the official
local stack has **not** been run — see K-3, K-8, K-9.

---

## Phase 3A — Premium UI & Storefront Foundation ✅

**Status:** Complete · **Target version:** v0.3.0 · **Data:** mock only

> **Phase 3 was split.** It originally bundled the interface with auth,
> services and database wiring, and was blocked on **K-3**. The brief for this
> phase excluded the database explicitly, so the interface shipped first as 3A
> against `mocks/` (ADR-36) and everything needing Supabase became 3B below.
> Splitting it let the UI proceed without pretending K-3 was closed.

- [x] Design system: 16 shadcn primitives, 12 project components
- [x] Colour system — blue primary, neutral, orange for discounts only (ADR-37)
- [x] Light and dark mode via `next-themes`, no flash on first paint
- [x] Header — sticky, search, categories menu, wishlist, basket, mobile nav
- [x] Footer — shop, support, company, social, newsletter
- [x] Home page — 10 sections
- [x] Product cards with discount, stock, rating, quick actions, hover states
- [x] `/products` listing with category filter, search filter, empty state
- [x] `/products/[slug]` detail — 12 prerendered, specs table, related rail
- [x] Skeletons, empty states, toast notifications
- [x] Responsive from 375px to desktop; keyboard and ARIA verified in the DOM

**Exit criteria met:** `npm run verify` passes, 17 routes prerender, one
`<h1>` per page, zero dead links, zero unnamed controls, accent colour used
only for price reductions.

---

## Internationalization ✅

**Status:** Complete · Delivered after 3A closed, as a cross-cutting change
rather than a phase — it touches every phase from here on.

- [x] Uzbek (default), Russian, English; locale in the URL (`/uz`, `/ru`, `/en`)
- [x] next-intl with `[locale]` routing (ADR-38), always-prefixed (ADR-40)
- [x] 8 namespaces × 3 locales, split by feature; no hardcoded user-facing text
- [x] Catalog copy localized on the record, not in `messages/` (ADR-39)
- [x] Locale-aware prices, numbers and ICU plurals
- [x] Canonical + `hreflang` + `og:locale` per page and per locale
- [x] Language switcher preserving route and query; `NEXT_LOCALE` persistence
- [x] `npm run check` fails on translation drift; ESLint blocks `next/link`
- [x] Fixed two silent Next.js 404 defects found while verifying (ADR-41, ADR-42)

**Exit criteria met:** `npm run verify` passes, 45 routes prerender across three
locales, and a 51-check runtime audit passes — routing, persistence,
negotiation, `hreflang`, formatting, plurals, heading ids, link prefixes and 404
status in all three languages.

**Not verified:** native-speaker review of the Uzbek and Russian copy (**D-14**).

---

## Phase 3B — Storefront Data Wiring

**Status:** 🟡 In progress · **Target version:** v0.4.0

The shopping experience, read-only. Now also carries the auth flow and the first
services, which moved out of Phase 2 when it was scoped to the database only.

### Done

- [x] **K-3** — `types/database.ts` generated and committed, 18 tables
      (**ADR-48**, no Docker required)
- [x] **D-7** — schema verification harness committed as `npm run db:verify`,
      33 assertions, now part of `npm run verify`
- [x] Service layer: products, categories, brands, inventory, storage, settings,
      audit — with in-query filtering, sorting and pagination
- [x] `lib/supabase-error.ts` — Postgres codes mapped to `AppError`
- [x] Supabase integration audit: four clients, middleware, session handling

### Blocked

- [ ] **K-15** — the schema is single-language and cannot store `LocalizedText`.
      **This gates everything below it.** See § "Translated content in the
      database" for the design
- [ ] **K-16** — reconcile the admin's publishing and inventory vocabulary with
      `product_status`, `product_visibility` and `inventory_movement_type`
- [ ] A Supabase project: `.env.local`, `supabase link`, `db push`. Without one
      nothing can be executed, only compiled

### Prerequisites still open

- [ ] **K-8** — verify storage RLS at runtime, especially avatar folder scoping
- [ ] **K-9** — confirm the seed's `auth.users` inserts work against real GoTrue

### To verify once a project exists (**D-18**)

Nothing below has ever run. Each is an assertion to make, not a claim:

- [ ] Every service function against real data — create, read, update, soft
      delete, restore, duplicate
- [ ] Search, filtering, sorting and pagination return what the admin expects
- [ ] Anonymous sees only `status = 'active' and visibility = 'public'`
- [ ] A customer can read their own profile and no one else's
- [ ] Each of the five roles is allowed exactly its granted permissions
- [ ] A write refused by RLS surfaces as `forbidden`, not as a crash
- [ ] Upload, replace, reorder and delete against the five buckets
- [ ] A stock movement updates `quantity_on_hand`; a direct write is rejected
- [ ] `audit_logs` rejects update and delete, service role included

### Replacing the mock layer (D-11)

The interface is finished and typed against `types/catalog.ts`. Wiring it is
therefore a swap, not a rebuild:

- [ ] `services/products.service.ts` maps `Tables<"products">` onto
      `ProductSummary` / `Product` — the same shapes the components already take
- [ ] Point `app/page.tsx`, `/products` and `/products/[slug]` at the services
- [ ] **Delete `mocks/`.** `npm run check` then reports every remaining
      reference as a compile error
- [ ] Move filtering and search into the query — the listing filters in memory
      today, which does not survive 50k products (**D-2**)

### Translated content in the database (ADR-39)

The mock catalog carries `LocalizedText` on every content field, which is the
shape the schema has to reproduce. Decide and record before writing the
migration:

- [ ] Per-locale columns, a `product_translations` table, or a `jsonb` column —
      a translations table is the usual answer, and the one that lets a
      merchandiser add Russian without a schema change
- [ ] `search_vector` is currently one `tsvector` with a `simple` config. Three
      languages need either three columns or a per-locale index; searching
      Russian text against an Uzbek dictionary silently returns nothing
- [ ] Specification labels are a shared vocabulary keyed into `messages/`
      today — in the database they want a `spec_definitions` table with
      per-locale labels rather than free text on every row
- [ ] Reviews are **not** translated. They carry the locale they were written
      in, and the UI labels that rather than rewriting the customer's words
- [ ] Product photography into the `products` bucket; `ProductImage` becomes
      `next/image` behind the same wrapper (**D-12**)

### Auth flow (moved from Phase 2)

- [ ] Sign-in, sign-up, sign-out
- [ ] `/auth/callback` route handler
- [ ] Password reset
- [ ] Resolves **K-2** (redirect currently lands on a 404)

### Services (moved from Phase 2)

- [ ] `services/products.service.ts`, `services/categories.service.ts`,
      `services/brands.service.ts` — per the contract in `services/README.md`
- [ ] Schema-qualify trigram search or use `extensions.similarity()` (**K-10**)

### Catalog

- [ ] Route group `app/(storefront)/` (pays down **D-5**)
- [ ] Product listing with filter, sort and pagination
- [ ] **Keyset pagination** for catalog browse; `count: "estimated"` for totals
      (pays down **D-2** — offset pagination does not hold at 50k products)
- [ ] Product detail page with variants and image gallery
- [ ] Category pages
- [ ] Full-text search with a debounced input (`use-debounced-value`)
- [ ] Real navigation replacing the header placeholder, with a mobile menu
      (`use-media-query`); pays down **K-7**
- [ ] Real footer replacing the placeholder
- [ ] Loading UI per segment using `Skeleton`
- [ ] `next/image` throughout, Supabase Storage sourced
- [ ] `app/robots.ts` and `app/sitemap.ts` (pays down **D-6**)
- [ ] Per-page canonical URLs, product structured data (JSON-LD)
- [ ] Re-measure bundle after `zodResolver` lands (**D-3**)

**Exit criteria:** a shopper can browse, filter, search and view any product;
Lighthouse SEO and accessibility both ≥ 95; First Load JS still under 200 kB.

---

## Phase 4 — Cart & Checkout

**Status:** Not started · **Target version:** v0.4.0

The largest and highest-risk phase. Money moves here.

- [ ] `carts` / `cart_items`, with guest carts merged into the user cart on sign-in
- [ ] Cart page and cart drawer
- [ ] Checkout flow: address → shipping → payment → review
- [ ] Payment provider integration (Stripe assumed; decide and record as an ADR)
- [ ] `orders` / `order_items`, with prices **snapshotted at purchase time** —
      an order must never re-read a product's current price
- [ ] Idempotent webhook handler for payment confirmation
- [ ] Stock decrement in a transaction; oversell prevention
- [ ] Order confirmation page and email
- [ ] **Content-Security-Policy with a per-request nonce in middleware**
      (resolves **K-4**) — it belongs here because this is where a payment iframe
      and a third-party script first enter the page
- [ ] Tests for cart maths, tax and totals — non-negotiable in this phase

**Exit criteria:** a full purchase completes end to end against the payment
provider's test mode; webhook replay is idempotent; concurrent checkout cannot
oversell; CSP active with no console violations.

---

## Phase 5 — Customer Accounts

**Status:** Not started · **Target version:** v0.5.0

- [ ] Route group `app/(account)/`
- [ ] Account dashboard
- [ ] Order history and order detail
- [ ] Address book
- [ ] Profile and password management
- [ ] Email preferences

**Exit criteria:** a customer can see every order they placed and nobody else's,
verified against RLS with a second account.

---

## Phase 6 — Admin: data, auth and orders

**Status:** Interface complete, everything behind it outstanding ·
**Target version:** v0.6.0

> **The interface was built early** (**ADR-46**), against mock data, because the
> brief asked for it. What remains is everything the interface stands on.

Built for 10+ concurrent admins.

### Done

- [x] Admin layout — sidebar, top bar, breadcrumbs, notifications, user menu
- [x] Permission-aware navigation, filtered server-side from the Phase 2 model
- [x] Product list and editor, including variants (**D-8** now has a UI shape)
- [x] Category, brand, inventory, homepage, page, settings, team and audit screens
- [x] Global search across products, categories, brands, customers, orders and pages
- [x] Admin-side search, filtering, sorting and pagination — **in memory** (D-2)

### Outstanding

- [ ] **Role check in the admin layout — the first task, before the panel is
      reachable in production** (resolves **K-1**; deletes `isAdminPreview` in
      `supabase/session.ts`, ADR-45)
- [ ] Sign-in, so the redirect target exists (**K-2**)
- [ ] Services behind every screen; delete `mocks/admin.ts` (**D-15**, **D-16**)
- [ ] Product image upload — needs Supabase Storage (**D-12**)
- [ ] Order management: status transitions, refunds, notes — **needs an `orders`
      table, which arrives with Phase 4**
- [ ] Customer lookup against real profiles
- [ ] Move pagination and search into the query; the current in-memory filter
      does not survive 50k products (**D-2**)
- [ ] `product_variants` table to back the variant editor (**D-8**)
- [ ] Write real audit rows for every privileged mutation

**Exit criteria:** a non-admin account is denied at the layout _and_ by RLS
(verified separately — the layout check alone is not the boundary); two admins
editing concurrently do not clobber each other.

---

## Phase 7 — Commerce Features

**Status:** Not started · **Target version:** v0.7.0

- [ ] **Wishlist** — persisted per user, mergeable from guest state
- [ ] **Reviews** — verified-purchase badge, moderation queue, rating aggregates
- [ ] **Coupons** — fixed and percentage, usage limits, expiry, per-user caps,
      stacking rules decided and recorded as an ADR
- [ ] Related and recently-viewed products
- [ ] Back-in-stock notifications

**Exit criteria:** coupon edge cases covered by tests (expired, over-limit,
stacked, applied to an ineligible cart); review aggregates cannot be manipulated
by a user who did not purchase.

---

## Phase 8 — Operations

**Status:** Not started · **Target version:** v0.8.0

- [ ] **Invoices** — PDF generation, stored in Supabase Storage, owner-scoped
- [ ] **Shipping** — zones, rates, carrier integration, tracking numbers
- [ ] Transactional email templates
- [ ] **Analytics** — product views, conversion funnel, revenue reporting
- [ ] Admin reporting dashboard
- [ ] Returns and refunds workflow

**Exit criteria:** an order produces a correct invoice and a tracking number;
analytics numbers reconcile against the orders table.

---

## Phase 9 — Production Hardening

**Status:** Not started · **Target version:** v1.0.0

- [ ] **Test suite** — unit for services and utils, integration for actions, E2E
      for the purchase path (pays down **D-1**)
- [ ] **CI** — `npm run check`, build, tests, dependency audit on every PR;
      pin the npm version so `allowScripts` behaves (resolves **K-6**)
- [ ] Rate limiting on auth and Server Actions
- [ ] Error tracking and structured log drain wired to `lib/logger.ts`
- [ ] Load testing against 50k products and realistic concurrency
- [ ] Core Web Vitals budget enforced in CI
- [ ] Backup and restore runbook, verified by an actual restore
- [ ] Accessibility audit against WCAG 2.2 AA
- [ ] Security review and penetration test
- [ ] Re-evaluate Edge middleware cold-start cost with real traces (**K-5**)

**Exit criteria:** every known issue closed or consciously accepted in writing;
restore drill passed; v1.0.0 tagged.

---

## Milestones

| Milestone                | Phase | Meaning                                        |
| ------------------------ | ----- | ---------------------------------------------- |
| Foundation signed off    | 1 ✅  | Architecture fixed; features can start         |
| First real data          | 2     | Schema, RLS and generated types exist          |
| Browsable storefront     | 3     | A shopper can find any product                 |
| First completed purchase | 4     | Revenue is technically possible                |
| Self-service customers   | 5     | Customers stop emailing about order status     |
| Merchant-operable        | 6     | The store runs without a developer             |
| Feature parity           | 7     | Competitive with a standard ecommerce offering |
| Back office complete     | 8     | Fulfilment and reporting no longer manual      |
| Production ready         | 9     | v1.0.0                                         |

---

## Explicitly out of scope

Not planned. Revisit only with a recorded decision.

- Multi-tenancy or multi-store
- **Multi-currency.** Prices are integer minor units of one store-wide currency
  (ADR-2); a second currency needs a `currency` column on every priced row
  (**D-9**). Locale changes how an amount is _formatted_, never which currency it
  is in.
- Native mobile apps
- A headless API for third-party consumers
- Marketplace or multi-vendor selling
- Subscriptions and recurring billing
