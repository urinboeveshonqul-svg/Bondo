# Changelog

All notable changes to Bondo are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until v1.0.0 the minor version tracks the phase: v0.1.0 is Phase 1, v0.2.0 is
Phase 2, and so on. v1.0.0 is the production launch at the end of Phase 9.

---

## [Unreleased]

### Changed — the three languages are now written, not translated

The previous pass fixed every word-level defect and still left the real problem
standing: all three languages shared one sentence. The home page hero was the
proof — same "X not Y" shape, same margin/маржа/foyda metaphor, same em-dash in
the same slot. Correct words, copied structure.

**The home page was rewritten three times from the business idea**, not from each
other. Each language now leads on a different pitch, because each market asks a
different first question:

|         | Leads on                                                          |
| ------- | ----------------------------------------------------------------- |
| Uzbek   | who did the work — `O'zimiz yig'amiz, o'zimiz sinaymiz`           |
| Russian | fit to task — `Соберём конфигурацию, которая закроет вашу задачу` |
| English | the buyer's decision — `You pick the parts. We prove they work.`  |

Headings are different lengths. Paragraph counts differ. No em-dash lands in the
same slot twice. Errors, empty states and the auth pages were rewritten the same
way: Uzbek plain and short, Russian terse and impersonal, English conversational
and taking the blame.

**And it is now enforced.** `copy:check` gained a structural rule: it strips the
words from a string, leaving only its punctuation skeleton, and fails when all
three languages share a _distinctive_ one on the same key.

Calibrated against the repository's own history rather than guessed — it flags
the old hero and the old empty state, and passes the rewrites. Two refinements
came out of that: ICU plural syntax is stripped first, because
`{count, plural, …}` is identical in every language by definition and made every
pluralized string look copied; and a bare `?` or `..` is not distinctive, because
that is the shape of most short copy everywhere.

It then found **seven more** across the admin hints and the catalog description
that the manual pass had missed. All seven were rewritten.

Atomic labels are exempt and say so: "Saqlash" / "Сохранить" / "Save" are what
each language actually calls that button, and forcing them apart would be worse
than leaving them alike.

### Added — the Bondo copy standard, enforced (CLAUDE.md § 11a)

**Uzbek is now the master language.** Copy is written in Uzbek first and then
_adapted_ into Russian and English, never translated word for word — because the
sentence shape survives translation even when the words change, and that is what
makes a site feel foreign.

`npm run copy:check` joins `npm run check` and fails the build on the tells that
are exact every time they appear: an Uzbek case suffix detached from its
placeholder, a customer-facing string naming our infrastructure, and a protected
technical name transliterated into Cyrillic.

It deliberately does **not** grade tone. A checker that guessed at register would
fail honest copy and train everyone to ignore it — so tone stays a review
judgement, and the reviewer should be a native speaker (**D-14**).

Proven rather than assumed: each of the three rules was fired by injecting a
fault before the pass was declared clean.

### Fixed — the defects the audit found

- **Six detached case suffixes** in Uzbek — `{name} ni`, `{amount} dan`,
  `{when} da`. Ungrammatical, and the signature of a sentence assembled from an
  English template rather than written in Uzbek.
- **A technical leak in all three languages.** The catalogue error told a shopper
  the product _database_ had not answered. Rewritten in each language for its own
  reader; none of the three now mentions infrastructure.
- **Wishlist vocabulary** — `sevimlilar` became `saralanganlar`, the word the
  standard names. Russian and English already used what their shoppers expect, so
  neither changed.
- **`Bondo'dan`** → `Bondodan`. An apostrophe before a case suffix on a foreign
  proper noun is a transliteration habit, not Uzbek orthography.
- **Ratings** read `4.8 / 5` instead of `5 balldan 4.8`, which reads like a school
  mark rather than a product rating.
- **The hero paragraph** was one long sentence with an English em-dash aside. It
  is two now.

**Not claimed:** that all 893 strings per locale were rewritten. This pass fixed
what is demonstrably wrong and added the gate that stops it recurring. Register
across the whole catalogue is **D-14** and needs a native speaker.

### Added — product variants, in the database (D-8 closed)

The admin has had a variant editor since Phase 3A with **no table under it**. A
laptop sold in 16GB and 32GB needed two product rows, with two descriptions, two
image sets and two SEO records to keep in step.
`20260808001000_product_variants.sql` closes that:

```
product_options → product_option_values → product_variants
                                        → product_variant_options
```

Five tables, normalized rather than a `jsonb` blob of `{ ram: "32GB" }`, for the
reasons ADR-51 already gives: a blob cannot enforce "exactly one value per
axis", cannot be indexed usefully, and cannot carry a foreign key — so renaming
a value silently orphans every variant that used it. The axis display name is a
`product_option_translations` row like every other piece of localized copy;
the _values_ are deliberately not localized, because "32GB" is a specification
and "32ГБ" is unsearchable (**D-27**).

**Stock did not move onto the variant** (**ADR-62**). `inventory` and
`inventory_movements` gained a nullable `variant_id` instead —
`variant_id IS NULL` is the product's own stock, not-null is that
configuration's — so one ledger, one append-only guard and one movement enum
serve both levels. The alternative, a `stock_on_hand` column on the variant, is
exactly the second writable copy of a quantity ADR-24 exists to forbid.

That restructuring moved `inventory`'s primary key off `product_id` onto a
surrogate, with **two partial unique indexes** carrying what the key used to
mean. A plain `unique (product_id, variant_id)` does not work: NULLs are
distinct in a unique index, so a product could quietly acquire two product-level
rows.

`product_images` gained a nullable `variant_id` rather than a second image
table — one uploader, one bucket, one ordering rule.

**The seed caught a real break during verification.**
`create_inventory_for_product()` targeted `on conflict (product_id)`, which
resolved to the primary key the migration had just dropped; it now names the
partial unique index. That is what running the seed inside `db:verify` is for.

`npm run db:verify` grew from 76 to **89 assertions**, re-proving ADR-24 at the
new level: a variant gets an inventory row from birth, a direct write to variant
stock is refused, a variant movement moves variant stock **and leaves the
product's alone**, a variant cannot hold two values on one axis, and a variant
SKU is unique across the catalog.

### Added — `services/variants.service.ts`

The fold between the axis matrix the editor speaks and the normalized rows the
database holds. Nothing above it sees a join table; nothing below it sees a
matrix.

`syncVariants` reconciles **by option combination, never by array position**, so
regenerating after adding a value to an axis leaves the prices already entered on
every combination that survives — the behaviour the Phase 3A editor described and
could not implement without a table to persist it to. A combination that
disappears is soft-deleted, because an order will reference it once checkout
exists.

There is deliberately **no stock setter**: `Variant.stockOnHand` is read from
`inventory` and changing it goes through `recordMovement`. A setter here would be
the obvious place to get ADR-24 wrong.

Verified against the hosted project: the full nested read — variants, their
options, the option translations and the joined inventory row — returns `200`
with every column and embed resolving.

### Added — settings sections for what does not exist yet

`SETTINGS_SECTIONS` gained a `status` of `live` or `planned`. Localization,
Appearance, Taxes, Shipping and Payments are declared and render a stated gap:
what is missing, and **what has to land first** — the checkout phase, shipping
tables, a per-account locale column, a store-level theme.

A planned tab has no inputs at all. Hiding it makes the roadmap invisible to the
person running the store; rendering an empty form invites them to fill it in and
lose the work, which is ADR-20's failure arrived at from the other direction —
not fake data, but a fake control.

### Added — Phase 4A: authentication, complete (K-1 and K-2 closed)

**The panel is no longer open.** `requireAdmin()` reads the `admins` register
and the role graph for the signed-in user; `isAdminPreview` and the `NODE_ENV`
gate (ADR-45) are deleted. Verified with real session cookies against
`next start`: a signed-in customer gets **404** at `/admin` and at a deep admin
route, and the bootstrapped administrator gets 200. A 404 rather than a 403,
because a 403 confirms the route exists and is worth attacking.

All thirteen admin routes now resolve permissions from the database instead of
`getAdminSession()`, the fixture they had rendered against since Phase 3D.

**Nine pages**, all localized in uz/ru/en: sign-in, sign-up, forgot-password,
reset-password, verify-email, the `/auth/callback` route handler, and account
overview / profile / security.

**Eight Server Actions**, every one through `createAction()` with a Zod schema —
a Server Action is a public HTTP endpoint and the form is not the only thing that
can POST to it. No component touches Supabase or the auth service directly.

**Errors are translation keys, not sentences.** GoTrue's messages are
English-only and untranslatable by a UI that sees a string, so the service maps
them to stable codes and one table in the actions layer maps those to keys. The
services were not modified to do it.

**One page for every email link.** `/auth/callback` exchanges the code and
forwards; an expired or replayed link redirects to `/verify-email` with a reason
rather than throwing, because an expired link is Tuesday, not an exception
(K-19).

**Passwords.** A shared contract in `lib/auth/password.ts` drives both the Zod
schema and the strength meter, so the meter cannot call a password acceptable
that the action then rejects. Ten characters and three of four character classes;
length weighted above class count, because length is what resists an offline
attack. Changing a password **requires the current one** — Supabase does not ask,
which means an unattended logged-in browser is otherwise enough to take an
account over.

**The bootstrap command.** `npm run admin:bootstrap -- --email you@example.com`
creates the auth user, asserts the trigger made the profile and wishlist, inserts
the `admins` row, grants `super_admin`, reads the grant back, and writes an
`audit_logs` entry. Idempotent, and it refuses to run when an active
administrator already exists unless `--force` is passed. A script and never a
route: behind HTTP, "create the first admin" is "create an admin".

### Fixed — no user who had written an audit entry could ever be deleted (K-22)

`audit_logs.actor_id` referenced `auth.users` with `on delete set null`, while
`audit_logs` carries a `before update or delete` trigger that rejects every
mutation (ADR-27). The two are incompatible: the cascade tries to UPDATE the
audit row to null the actor, the guard raises, and the whole
`DELETE FROM auth.users` rolls back.

It surfaced as an opaque GoTrue **500 with an empty body** — no constraint name,
no table, nothing pointing at the audit log. Found while deleting the bootstrap
administrator and isolated against test users that deleted cleanly, the
difference between them being exactly one audit row.

**Every administrator writes audit entries by definition**, so the entire staff
register was permanently undeletable, and any customer would have been the moment
audit coverage reached customer actions.

`20260807001000_audit_log_independence.sql` drops the foreign key rather than
weakening the guard (**ADR-61**). Weakening it was the other option and it is
wrong twice: one exception is how a log stops being evidence, and nulling the
actor erases the single field the row exists to hold. The log now outlives its
actors and keeps both `actor_id` and `actor_email`. Erasure is still possible —
it is a deliberate redaction rather than a silent side effect of closing an
account, which is what a data-protection request actually calls for.

Verified: the bootstrap administrator was deleted, `profiles`, `wishlists`,
`admins` and `user_roles` all cascaded away, and both audit entries survived
still naming who acted.

### Fixed — an administrator had no way into the panel

Nothing outside `/admin` linked to it, so the only route in was typing the URL.
The entry now appears on `/account` — a card naming the roles held, with a
button — and in the account sidebar, for an active administrator only.

**On `/account` rather than in the site header**, deliberately. The header
renders on every storefront page, so an admin link there would mean asking "who
is this, and are they staff" on every product view for every visitor: a GoTrue
round trip plus two queries that ADR-11 exists to avoid. The account layout's
guard has already resolved roles for that request, so showing it there costs
nothing extra.

It is a shortcut, not a gate — `requireAdmin()` and RLS still decide what opens.
Verified with real sessions: the administrator sees it in Uzbek and Russian and
it points at the locale-correct `/admin`; a plain customer's `/account` contains
no admin entry and no `/admin` href at all.

### Fixed — a password-reset enumeration oracle (ADR-60)

Found by measurement rather than review. The service surfaces rate limiting so a
caller is never left clicking a dead button — but on the reset endpoint that
distinguishes a registered address (mail attempted, quota consumed, error) from
an unknown one (no mail, clean return). It appeared against the live project
exactly when the mail quota was exhausted, which is when an attacker would be
probing. That one action now swallows the rate limit and logs it without the
address; every other action still surfaces it.

### Found — transactional email is the built-in mailer (K-21)

A live registration was accepted and then failed at the mail step with
`email rate limit exceeded`. Supabase's built-in SMTP allows a handful of
messages an hour and is explicitly not for production; confirmation, resend and
password reset all depend on it. **This gates launch** and is invisible until a
real user cannot register.

### Verified — against the hosted project, not mocked

Registration through the public anon path, profile and default wishlist created
by the trigger, a customer holding no role and no admin row, sign-in after
confirmation, wrong password rejected, RLS reading own profile and refusing
another's, self-granting a role refused (`42501`), sign-out clearing the session,
the bootstrapped admin resolving all 20 permissions, and user deletion cascading
the profile. Route protection was driven over HTTP in all three locales:
`/account`, `/admin` and `/checkout` all answer `307` to a localized sign-in
carrying `redirectTo`.

### Added — Phase 4A groundwork: authorization and the auth service layer

**Partial. The phase is not complete** — see "Not done" below. What landed is
the server-side core, which is the part where a mistake is dangerous.

**Registration can no longer orphan a user.**
`20260806001000_registration_defaults.sql` extends `handle_new_user()` to create
the default wishlist alongside the profile, in the **same trigger and the same
transaction as the signup**. Doing it in application code after `signUp()`
returns would leave an `auth.users` row with nothing attached whenever the
second call failed, and the application cannot retry it. Includes a backfill for
accounts registered before it — no rows today, but a migration that only works
on an empty database is one that fails the first time it matters.

**Authorization now reads the database.** `services/authorization.service.ts`
resolves `admins`, `user_roles`, `roles`, `role_permissions` and `permissions`
for a user through the RLS-enforced client, memoised per request (ADR-12). It
replaces the `getAdminSession()` fixture the admin panel has rendered against
since Phase 3D. A deactivated administrator (`is_active = false`) resolves to
zero roles _and_ zero permissions, so the interface cannot show a role beside a
panel that refuses every action.

**Every Supabase Auth call is behind one service.** `services/auth.service.ts`
covers sign-up, sign-in, sign-out (local and global), password reset request,
password update, current-password verification, verification resend, and the
code exchange used by every email link. No custom authentication: GoTrue hashes,
compares, rotates and rate-limits.

GoTrue's errors are re-mapped onto **stable codes** — `invalid_credentials`,
`email_taken`, `email_not_verified`, `weak_password`, `expired_link`,
`same_password`, `rate_limited` — matched on `error.code` first and prose only as
a fallback. Upstream messages are English-only and untranslatable by a UI that
sees a string, so the wording becomes a translation decision instead of an
upstream one.

**Password reset and verification-resend do not confirm whether an address
exists.** Both resolve either way; only rate-limiting surfaces, because silently
succeeding teaches somebody to keep clicking a button that is doing nothing.

### Not done — the rest of Phase 4A

No UI, no Server Actions, no bootstrap command, and **K-1 is still open**. The
services compile and are typechecked against the live schema; nothing calls them
yet. That boundary is deliberate rather than convenient: closing K-1 means
deleting `isAdminPreview` (ADR-45), and deleting it before a `/sign-in` page
exists makes the admin panel unreachable in development too — the two have to
land together.

Remaining, in the order it should be built: Server Actions over these services;
sign-in, sign-up, forgot-password, reset-password, verify-email and the
`/auth/callback` route handler; the account pages; the admin layout's real role
check plus removal of `isAdminPreview`; the bootstrap command; and the `auth`
and `account` message namespaces in all three locales.

### Changed — the application talks to a real Supabase project

A hosted project exists and is linked: **`pgxqnezwrwfgrmamlxhs`**, `ap-southeast-1`,
Postgres 17.6.1.155 / PostgREST 14.15 / GoTrue 2.195.0 / Storage 1.67.26. All
**11 migrations are applied**, local and remote in lockstep, including
`20260805001000_social_metadata.sql`.

`.env.local` held a local-stack placeholder — `http://127.0.0.1:54321` with the
published `supabase-demo` anon key — written while no project existed. It now
carries the project's real URL and anon key. The file is git-ignored; nothing
about it is committed.

**`SUPABASE_SERVICE_ROLE_KEY` is deliberately still unset.** Nothing imports
`supabase/admin.ts` — verified, the only references to it are comments — so the
key that bypasses RLS has no consumer. It is added when a webhook or job needs
one, not before.

### Verified — against the live project, as the anonymous role

- **No schema drift.** `db:types:remote` compared structurally against the
  committed file: **26 type entries, 103 columns, 19 enum values — identical.**
  The only textual differences were formatting and an added
  `__InternalSupabase.PostgrestVersion`, so the committed file was kept (**D-17**).
- **The services' real queries execute.** `categories`, `brands` and `products`
  all return 200 with every column and embedded select resolving —
  `brands`, `categories`, `inventory` and all three `*_translations` embeds. A
  wrong column name would have been a `42703` here and was not (**D-18**,
  partially paid).
- **RLS is active and filtering**, not merely permissive: `settings` returns 4 of
  its 6 rows to `anon`, and `inventory`, `audit_logs`, `profiles` and `admins`
  are refused at the GRANT layer before RLS is even reached.
- **All five storage buckets** exist with their intended size and MIME limits;
  `avatars` is private (**K-8** — the object policies are still unproven, because
  an empty bucket answers `200 []` whether the policy is right or wrong).
- **Every route renders** in development against the project: `/` → `/uz`,
  `/uz`, `/ru`, `/en`, `/products` → `/uz/products`. Zero fixture fallbacks
  fired, which is the proof the reads succeeded rather than degraded, and zero
  requests to `127.0.0.1:54321`.
- `npm run verify` passes: 76 schema assertions, 749 translation keys per locale,
  production build clean.

### Known state — the catalog is empty

0 products, categories, brands, content pages, banners, admins and profiles. The
6 settings, 5 roles, 20 permissions and 41 grants that _are_ present come from
`INSERT`s inside the migrations. `supabase db push` does not run
`supabase/seed.sql`, which is development fixture data guarded against non-empty
databases (ADR-25) — so this is the designed outcome of deploying a schema, not a
failure. The storefront renders it correctly as an empty shop.

### Fixed — every route returned 500 in production (K-18)

**One query in a layout took down the entire site.**
`app/[locale]/layout.tsx` awaited `listCategories()` to build the header's
category menu. That layout renders on every route beneath it, and **a layout's
own `error.tsx` cannot catch it** — `app/[locale]/error.tsx` renders _inside_
the layout, so React escalated past it to `app/global-error.tsx`, which replaces
the whole document. An unreachable database therefore returned 500 for `/`,
`/uz`, `/ru`, `/en`, every product page **and the 404 page**, which is why it
looked like a localization bug and was not one.

Found by reproduction, not by reading: `next start` against the same
configuration, then a probe of `/uz/definitely-not-a-page` — a route whose page
only calls `notFound()` — which returned 500 with exactly one logged exception.
That isolated the layout as the sole cause.

`listNavigationCategories()` replaces it: the same read, but chrome-scoped and
unable to throw. The rule it encodes is that **page content fails loudly and
chrome degrades** — a category menu is navigation, and losing a dropdown must
not cost a visitor the whole site, including its ability to serve a 404.

**A second bug was introduced and caught during the same fix.** The first
version of that catch swallowed Next.js's `DynamicServerError` — the control-flow
signal `cookies()` raises during prerendering so a route can bail out to dynamic
rendering. Catching it told the build "no categories" instead of "render on
demand", and an empty menu was baked into the prerendered HTML permanently. Both
catches now call `unstable_rethrow()` first, exactly as `createAction()` does for
`redirect()` and `notFound()` (ADR-13). Caught by rebuilding and reading the
log, not by reasoning about it.

### Fixed — a page that throws replaces the whole document (K-19)

With the layout fixed, `/uz` still answered with the unbranded global boundary,
and `/uz/products` answered **200 with an empty skeleton** — a permanent soft
error, the exact failure ADR-41 exists to prevent, applied to exceptions instead
of 404s.

Probed rather than assumed: a bare `throw new Error()` at the top of the home
page produced `<html id="__next_error__">`, never `app/[locale]/error.tsx`. An
exception in a Server Component aborts the shell before it flushes, so there is
no document for the route boundary to render into; and the only thing that
changes that — a Suspense boundary above the throw, which `products/loading.tsx`
provides — converts the 500 into a 200 that lies.

So storefront pages no longer throw. They read through `readCatalog()`, which
returns `null` when the catalog is unreachable, and render `CatalogUnavailable`:
localized, inside the site chrome, with the navigation working and the real
exception in the server log with its stack.

It does **not** show fixtures, and it does **not** say "no products" — an empty
catalog and an unreachable one are different facts and only one of them is true.
A slug that matches no row is still a 404: `notFound()` passes through
`unstable_rethrow()` untouched.

### Verified

Against `next start` with an unreachable database, before and after:

| Route                    | Before           | After                         |
| ------------------------ | ---------------- | ----------------------------- |
| `/`, `/uz`, `/ru`, `/en` | 500 global error | 200, localized catalog notice |
| `/uz/products`           | 200, empty shell | 200, localized catalog notice |
| `/uz/products/<slug>`    | 500 global error | 200, localized catalog notice |
| `/uz/<unknown>`          | 500 global error | 404                           |

### Found — the localized 404 does not render in production (K-20)

`/uz/<unknown>` returns the correct 404 **status** with the framework's built-in
document: no `<html lang>`, no chrome, no translated copy. The same URL under
`next dev` renders `app/[locale]/not-found.tsx` correctly. Same shell-abort
family as K-19, and pre-existing — it was unobservable because K-18 made every
URL 500 before it could 404.

Not fixed in this pass, deliberately: the obvious remedy reverses ADR-42, and a
speculative change to the root layout is how the 200-with-empty-body defect got
introduced in the first place.

### Added — Phase 3D: one architecture for every admin module

**A module is now a record, not a screen.** `lib/admin/modules.ts` holds one
entry per module — route, icon, navigation group, capability grants, form
sections, whether it is localized, whether it carries SEO, whether it has an
audit trail — and the sidebar, the mobile drawer, the breadcrumb root, the
command palette, the route guard and the form's section order are all derived
from it (**ADR-54**).

`lib/admin/navigation.ts` used to hold a second hand-written copy of every
module's href, icon and permission list. Two lists, one of them edited, is how a
module ends up reachable from the command palette and missing from the sidebar
for one role. It is now generated. **Verified**: the derived navigation was
compared against the previous lists for all five system roles and the visible set
is identical.

**Capabilities, without inventing permissions** (**ADR-55**). Every screen asks
the same seven questions — `view`, `create`, `update`, `delete`, `publish`,
`settings`, `export` — and each module's `grants` table answers them by naming an
existing database permission or `null`. `null` means the module does not offer
that capability **to anybody**, super admin included, which is exactly true of
`audit.create` and `inventory.delete`: a trigger refuses those writes regardless
of policy (ADR-24, ADR-27), so they render as absent controls rather than buttons
the insert would reject. ADR-44 still holds — not one permission was invented.

`guardModule()` resolves the set once per route, server-side, and answers 404
rather than 403, because a 403 confirms which module to go phishing for. Every
client component takes the same `capabilities` prop, so the permission model
never reaches the browser and a screen cannot invent its own rule.

**One component kit** in `components/admin/module/`: `ModuleHeader`,
`ModuleToolbar`, `ModuleSearch`, `ModuleFilters`, `ModuleColumnVisibility`,
`ModuleTable`, `ModuleBulkActions`, `ModulePagination`, `ModuleStatusBadge`,
`ModuleEmptyState`, `ModuleLoadingState`, `ModuleDeleteDialog`,
`ModuleDetailsDrawer`, `ModuleForm`, `ModuleTabs`, `ModuleCard`,
`ModuleMediaManager`, `ModuleImageUploader`, `ModuleLanguageTabs`,
`ModuleSeoPanel`, `ModuleAuditHistory`, `ModulePermissionGuard`,
`StatisticsCards` and the charts.

The table was decomposed rather than rewritten: search, filters, column
visibility, bulk actions and pagination are now components in their own right,
because three admin screens are not tables — the category tree, the homepage
composer, the page grid — and they needed the same search box without borrowing a
table to get it. **Column visibility is new**; the last visible column cannot be
hidden, because a table of checkboxes is unrecoverable without finding the menu
again in an empty page.

**One form layout** (**ADR-56**):
`general → media → pricing → inventory → seo → localization → advanced → publish`.
A module declares a subset and fills it in; it cannot reorder or invent a
section, because `sections` is keyed by the canonical union and rendered in the
order the contract defines. Section titles default to `admin.form.sections.*`, so
"General" is translated once rather than shipping as "Basics", "Details" and
"Overview" in three modules. The product editor was rebuilt onto it.

**One media manager**, with localized alt text on every file, keyboard
reordering (WCAG 2.2 SC 2.5.7 — a keyboard user has no drag at all), and a
primary that is promoted rather than orphaned when the current one is removed.
Uploading is disabled with the reason stated: Storage is not connected (**D-12**),
and a file input that accepts a drop and discards it teaches an operator that the
workflow works.

**One settings architecture.** `lib/admin/settings-sections.ts` is the registry;
the tab strip is derived from it. `shipping` and `taxes` are deliberately absent
and the omission is documented at the definition: tax rate and delivery
thresholds are already fields inside `commerce`, and Shipping in the sense a
store needs — zones, rates, carriers — needs tables that arrive with Phase 8.
Declaring the tab now would put an empty screen behind a real-looking label.

**One folder convention** (**ADR-58**), spanning layers rather than collapsing
them: screens in `components/admin/modules/<id>/`, data access in `services/`,
mutations in `actions/`. The brief proposed colocating services and actions under
each module; that is refused and recorded, because a service nested in a route
folder is one somebody eventually imports React into, and scattered Server
Actions make "is every one validated" unanswerable by inspection.

### Added — canonical and social metadata in the schema

The brief specifies canonical, Open Graph and Twitter fields in the shared SEO
panel, and the schema had none of them. CLAUDE.md § 12 decides the order, so
`20260805001000_social_metadata.sql` came first: `canonical_url`, `og_title`,
`og_description`, `og_image_path` and a `twitter_card` enum on
`product_`, `category_`, `brand_` and `content_page_translations`.

Per locale, like `seo_title`, because a share card carries a headline and usually
an image with words baked into it. Five columns rather than nine, with a
resolution chain — `twitter:title → og_title → seo_title → the record's name` —
so a store that writes nothing still emits complete cards and the same sentence
is not stored in three places to drift apart (**ADR-57**). A relative
`canonical_url` is rejected by a check constraint, proven by an assertion rather
than assumed.

`SeoFields` gained slug, canonical, Open Graph and card type; the panel renders
them all and reads its card options from `Constants.public.Enums.twitter_card`,
so the select cannot offer a value the insert rejects.

### Added — admin architecture documentation

**[docs/admin/](docs/admin/)** — why the modules share one architecture, a
start-to-finish checklist for adding one, the component reference, how
permissions resolve, and how localization works end to end. `adding-a-module.md`
is written as a checklist against the registry, in the database-first order:
migration, types, service, route, screens, strings, verify.

### Verified

`npm run db:verify` grew from 70 to **76 assertions** — the social metadata
columns on all four translation tables, the `twitter_card` enum, and a rejected
relative canonical. `npm run verify` passes: typecheck, lint, format,
translations (14 namespaces × 3 locales, **747 keys each**), enums, 76 schema
assertions and the production build. Heaviest admin route 195 kB first load,
shared JS 103 kB, middleware 105 kB — unchanged by the refactor.

### Not done — and why

No new module was built. Orders, customers and reviews were explicitly out of
scope for this phase, and orders in particular still needs a table that arrives
with checkout.

The runtime audits were **not** re-run. The i18n and admin audits in
`PROJECT_STATUS.md` describe the pre-refactor panel; no browser was driven in
this session (**D-20**, alongside **D-13**).

Four components in the kit have no caller yet — the delete dialog, the details
drawer, the loading state and the single-image uploader. They exist because the
brief specifies them and the modules that need them are one phase away, but an
unused component is an unproven one (**D-21**).

### Added — Phase 3C: localization is first-class in the database

**K-15 is closed.** Migration `20260804001000_localization.sql` replaces the
single `text` column per content field with six normalized translation tables,
each keyed `(entity, locale)` and cascading from its parent:
`product_translations`, `category_translations`, `brand_translations`,
`banner_translations`, `content_page_translations` and `setting_translations`.
`content_pages` is new — the static pages the footer already lists.

Not `jsonb`, deliberately (**ADR-51**): a blob cannot be constrained, cannot
carry a per-locale `tsvector`, and cannot have a unique index on a slug.

**Full-text search is per locale.** `search_vector` moved onto the translation
row and picks its dictionary from that row's language — `russian`, `english`, or
`simple` for Uzbek, which has no Postgres dictionary and is better left
unstemmed. Verified: "graphics" finds "graphics card" through the English
stemmer, and "nvidia" survives intact through `simple`.

**Slugs are per locale** (**ADR-52**), unique within a locale rather than
globally, so `/ru/products/videokarta-rtx-4090` is expressible.

**The old columns were dropped**, not left alongside — two places to write a
product name is the duplicate concept this phase existed to remove. Existing
rows are migrated to `en` in the same migration, and the seed was restructured
to match so `db:reset` still works.

**Services own translations.** Callers pass and receive `LocalizedText`;
`*_translations` never appears in a page or a component. `lib/i18n/translations.ts`
is the single fold — `toLocalizedText`, `toTranslationRows`, `pick`,
`coverageOf`, `isPublishable` — used by every service and every form, so a
second hand-rolled version cannot drop a language on save.

**A record is not publishable until every language has copy** (**ADR-53**),
enforced in the service and surfaced by the same function the form renders.

**Components**: `LocalizedTextField`, `LocalizedTextarea`, `LanguageTabs`,
`TranslationStatus`, `MissingTranslationIndicator`, `TranslationProgress`.

**`Locale` now derives from the database.** `public.locale` is an enum, so
adding a language is a migration — correct, because it also needs message files,
a font subset and a routing entry.

### Verified

`npm run db:verify` grew from 33 to **70 assertions**, and now applies the seed
as well as the migrations: 25 tables, RLS on every one, 64 policies, 53 foreign
keys, 75 indexes, every translation table keyed and cascading, per-locale unique
slug indexes, and the search dictionaries proven to differ per locale.

### Added — database-first policy (CLAUDE.md § 12)

The schema is the source of truth. Before UI changes: the schema must support
the feature, types are regenerated, services updated, and the UI consumes the
generated types. No UI state or enum may diverge from database values.

**Enforced, not documented.** `npm run enums:check` — part of `npm run check` —
parses the `Constants` block the generator emits and fails the build when a
hand-written union in `types/` either duplicates a database enum or, worse,
overlaps one while adding values the database would reject. Both failure modes
are covered; the second is the dangerous one, because it compiles, renders a
`<Select>`, and fails at the insert on a value the operator was offered.

Vocabularies with no column yet — order status before `orders` exists — are
allowed but must be declared in `scripts/check-enums.mjs` with a reason and the
table that will own them, so an honest gap is distinguishable from an omission.

### Fixed — K-16, the divergence the policy exists to catch

Adopting the policy closed it:

- `ProductStatus` was a hand-written `draft | published | hidden`. It now
  derives from `Enums<"product_status">` — `draft | active | archived`.
- **`product_visibility` became the separate control the schema always had.**
  "Is the work finished" and "should anyone see it" are different questions, and
  collapsing them was what made the interface offer states the database could
  not store. The product editor now has two selects, and `publishState()`
  resolves status, visibility and the scheduled date together.
- `MovementReason` derives from `Enums<"inventory_movement_type">`. The
  inventory dialog no longer offers `damage` or `recount`, neither of which
  exists; a write-off is `adjustment` and a miscount is `correction`, which is
  what the schema calls them.
- Status, visibility and reason labels realigned across all three locales.

### Added — Supabase integration (Phase 3B, partial)

**`types/database.ts` is generated. K-3 is closed.** It had blocked every query
in the project since Phase 2, because `supabase gen types` runs its generator in
a container — including with `--db-url` — and this machine has no container
runtime. `npm run db:types` now applies the 9 migrations to PGlite, serves them
over the Postgres wire protocol, and points `@supabase/postgres-meta` — the
package that container runs — at it (**ADR-48**). 18 tables, 970 lines,
generated by the official generator from the real SQL.

**The Phase 2 verification harness is committed. D-7 is paid.**
`npm run db:verify` is now part of `npm run verify` and makes **33 assertions**
against `pg_catalog` after applying every migration: 18 tables, RLS enabled on
all of them, 45 policies, 34 foreign keys each with a delete rule, 58 indexes,
every traversed foreign key indexed, 22 triggers including both append-only
guards, `updated_at` trigger-maintained on all 10 tables that have it, all 6
`SECURITY DEFINER` functions pinning `search_path`, and `products.search_vector`
confirmed generated.

**Seven services** — products, categories, brands, inventory, storage, settings,
audit. Explicit column lists rather than `select("*")`; embedded selects so a
product detail is one round trip rather than four; filtering, sorting and
pagination in the query rather than in memory; soft deletes because orders will
reference products; and `lib/supabase-error.ts` mapping Postgres codes to
`AppError` so a constraint name never reaches a user.

Notable behaviours the services encode rather than leave to callers: stock
changes **only** through `recordMovement`, because a trigger owns
`quantity_on_hand` and an overwrite would destroy the ledger; deleting an image
removes the storage object only when nothing else references it, because
duplicating a product shares files; and `recordAudit` swallows its own failures,
because an audit write that fails must not roll back the operation it describes.

### Found

Two blockers that only became visible once real types existed:

- **K-15 — the schema cannot store the application's content model.**
  `products.name`, `description`, `categories.name` and every other content
  column are a single `text`. The app models all of them as `LocalizedText`
  (uz/ru/en) per ADR-39. There are no translation tables, so mapping a row onto
  the UI's types would mean inventing two languages. This is the gate on
  replacing the mocks.
- **K-16 — the admin's vocabulary does not match the schema's enums.** The admin
  models publishing as `draft | published | hidden`; the database has
  `product_status` (`draft | active | archived`) _and_ a separate
  `product_visibility` (`public | hidden`). Inventory reasons differ too. The
  interface currently offers states the database cannot store.

Neither was found by reading the SQL — both surfaced the moment the generated
types met the code, which is the argument for having generated them.

### Changed

- `npm run verify` now runs `db:verify` between the checks and the build, so a
  migration that breaks the schema fails before the app is built.
- `npm run db:types` no longer requires Docker; `db:types:local` and
  `db:types:remote` keep the CLI paths for when one is available.

### Not done — and why

The mocks are **not** replaced and no page calls a service. Beyond K-15 and
K-16, there is no Supabase project: no `.env.local`, nothing linked. A page
calling a service would fail during static generation and take `npm run verify`
with it. Nothing about RLS behaviour, storage buckets or CRUD execution has been
verified at runtime, because there is nothing to run against — recorded as
**D-18**.

### Added — professional admin panel

A complete store-management interface on mock data. Thirteen routes × three
locales, every string translated, no page touching Supabase.

**Layout.** Collapsible sidebar that becomes a drawer below `md`, sticky top
bar, breadcrumbs, notifications, user menu, quick actions, theme and language
switchers. Navigation is **permission-filtered on the server** — a module an
administrator cannot use is absent, not greyed out, because a disabled
"Settings" advertises exactly which capability to go looking for.

**Dashboard.** Six stat cards with period-over-period deltas, revenue and order
charts, low stock, recent orders and recent activity. The charts are hand-written
SVG rather than a charting library: they render on the server, ship as markup,
and carry a visually hidden data table so a screen reader gets the figures rather
than the word "graphic".

**Products.** List with search, three filters, sortable columns, pagination, row
actions and bulk actions. Editor covering basics, localized descriptions,
pricing, publishing state (draft / published / hidden / scheduled), featured,
specifications, images, SEO and search keywords.

**Variants.** An axis editor — memory, storage, graphics — that generates the
combination matrix, with per-variant SKU, price, sale price, stock, weight and
active flag. Regeneration keeps rows whose combination still exists, so adding a
value to an axis does not silently wipe prices already entered.

**Categories, brands, inventory, homepage, pages, settings, team, audit.**
Category ordering is drag-and-drop **with keyboard Move up / Move down**, because
WCAG 2.2 SC 2.5.7 requires a non-dragging alternative and a keyboard user has no
drag at all. Inventory adjustment records a _movement_ with a reason rather than
overwriting a total, matching the append-only ledger the schema enforces
(ADR-27). The Roles screen prints the real grant table, so a permission that
drifts from the migration is visible on screen.

**Localization.** Six new namespaces, 523 new keys per locale (692 total).
`LocalizedField` gives every translatable field a three-tab control that shows
which languages are still empty — it is what makes the policy operable rather
than aspirational.

**Reusable pieces**, so no screen reimplements them: one `DataTable` behind every
list, one `SortableList` behind both ordering screens, one `SeoFieldset`, one
`FormSection`, one `StatusBadge`.

### Changed

- **Product `name` is now `LocalizedText`** (**ADR-47**). The brief lists it as a
  localized field, and it is right to: Bondo's own builds read differently in
  each language. Manufacturer model numbers go through a `modelName()` helper
  that declares the three identical copies once. This reversed a Phase 3A
  decision and touched ten files.
- The admin is reachable in **development only** (**ADR-45**), gated by a
  `NODE_ENV` check Next.js inlines at build time. Production behaviour is
  unchanged — `/admin` redirects to sign-in — and this is deleted when the real
  role check lands. It exists because `/admin` is a protected route pointing at a
  `/sign-in` page that does not exist, so the panel could not otherwise be built.
- `lib/routes.ts` gains the thirteen admin routes.
- `messages/*/adminSystem.json` nests permission labels (`permissions.products.read`
  rather than a flat `"products.read"` key), because next-intl reads a dot as
  nesting and the flat form silently missed on every lookup.

### Deliberate exemptions

- **ADR-46** — built out of roadmap order. The roadmap places the admin at Phase
  6, behind checkout; the brief asked for it now. Recorded rather than done
  quietly, because the skipped dependency shows: with no `orders` table the
  revenue, order and customer figures are fixtures and say so on screen, and
  order management cannot be built at all.
- **ADR-44** — the five roles are the schema's, not the brief's. The brief named
  Owner / Super Admin / Admin / Inventory Manager / Content Manager; the database
  ships `super_admin`, `catalog_manager`, `inventory_manager`, `support_agent`
  and `content_editor`, protected from rename by a trigger. Inventing a parallel
  vocabulary would mean offering capabilities the database refuses.
- **ADR-43** — `mocks/admin.ts`, on ADR-36's terms, derived from the storefront
  catalog rather than duplicating it (**D-15**).

### Added — internationalization (Uzbek, Russian, English)

The storefront is multilingual, with the locale in the URL: `/uz` (default),
`/ru`, `/en`. Built on next-intl with `[locale]` as the routing segment
(**ADR-38**).

**Every user-facing string is translatable.** 8 namespaces × 3 locales, 169 keys
each, split by feature — `common`, `header`, `footer`, `home`, `catalog`,
`product`, `newsletter`, `errors`. Components read them with `useTranslations`,
which works in Server Components, so a grid of sixty product cards still ships no
JavaScript for its text.

**Catalog copy lives on the record, not in `messages/`** (**ADR-39**). Product
descriptions, category names and image alt text carry all three languages as
`LocalizedText`, because they are per-row content written by merchandisers and in
Phase 3B they come from the database. Making the type a required record of every
locale means a product cannot be added in one language — TypeScript rejects it.

**Locale-aware formatting.** Prices, ratings and counts go through `Intl` with
the locale's BCP 47 tag: `$529.00`, `529,00 $`, `529,00 US$` — same amount, same
currency, three sets of conventions. The listing count uses ICU plurals because
Russian needs `few` and `many`, which a ternary cannot express.

**SEO.** Every page emits a self-referential canonical plus `hreflang` for all
three locales and `x-default`, generated from one unprefixed path so an alternate
can never point at the wrong page. `og:locale` and `og:locale:alternate` are set
per locale, and `<html lang>` carries the full tag.

**Persistence.** The choice is stored in `NEXT_LOCALE` for a year and outranks
`Accept-Language`; a first-time visitor with no cookie is negotiated from the
header, falling back to Uzbek (**ADR-40**).

**Enforced, not just documented.** `npm run check` now runs
`scripts/check-translations.mjs`, which fails on a missing namespace, a key
missing in either direction, an empty value, or an ICU placeholder renamed in one
language. ESLint blocks `next/link` and the locale-unaware `next/navigation`
helpers in favour of `@/i18n/navigation`.

### Fixed

- **An unknown product slug returned HTTP 200 with an empty body.**
  `products/loading.tsx` opens a Suspense boundary above the route, so the
  response shell flushed with 200 before `notFound()` ran — a soft 404 that
  invites dead URLs into the search index. Fixed with `dynamicParams = false`
  (**ADR-41**). Pre-existing; found while checking the 404 path in three
  languages.
- **An unmatched URL fell through to the framework's built-in English 404**,
  with no `<html lang>` and outside the app shell. A `not-found.tsx` inside a
  segment only catches `notFound()` from a route that matched, and without a root
  `app/layout.tsx` the convention was ignored altogether. Fixed with a
  `[...rest]` catch-all and a passthrough root layout (**ADR-42**).
- **Section heading ids collapsed to one value in Russian.** `Section` derived
  its `id` from the title with `replace(/[^a-z0-9]+/g, "-")`, which maps any
  Cyrillic heading to `section--`, so every `aria-labelledby` on the page
  resolved to the same element. `id` is now a required, language-independent
  prop.
- Category labels on the product page came from the slug
  (`"gaming-pcs"` → `"gaming pcs"`), which is English-shaped and identical in all
  three languages. They now come from the category record.

### Changed

- `lib/routes.ts` paths carry no locale prefix; `<Link>` from
  `@/i18n/navigation` adds it. Route constants stay comparable and adding a
  locale never touches the table.
- `utils/format.ts` takes a required `locale` argument. A default would have made
  wrong output the quiet outcome at every call site that forgot to pass one.
- `lib/site-config.ts` holds the locale table. It is the one module `utils/`,
  `i18n/` and the Edge middleware chain may all import, so anywhere else would
  have meant duplicating the list.
- Middleware composes locale routing with Supabase session refresh. Anonymous
  requests — most traffic — get next-intl's response unchanged; authenticated
  ones transplant the rewrite, the `hreflang` header and the locale cookie onto
  the session response rather than copying headers blindly, which would clobber
  Next.js's private request-header channel and drop the rotated auth cookie.
- The Geist subsets now include `cyrillic`. A missing subset does not fail — it
  silently falls back to a system font, so the Russian site would have rendered
  in a different typeface with nothing to report it.

### Added — Phase 3A, premium UI and storefront foundation

The interface a customer sees, built end to end against mock data. No page
touches Supabase.

**Design system.** 16 shadcn primitives plus 12 project components —
`ProductCard`, `ProductGrid`, `Price`, `DiscountBadge`, `Rating`,
`StockIndicator`, `ProductImage`, `ProductCardSkeleton`, `EmptyState`,
`Section`, `NewsletterForm`, `ThemeToggle`. Light and dark via `next-themes`
with no flash on first paint. Colour is blue primary, neutral surfaces, one
green for in-stock, and orange for price reductions only (**ADR-37**) — which
cost the star rating and the low-stock label their accent, because an amber
star beside an orange sale price makes a well-reviewed product look discounted.

**Header.** Sticky, with search, a categories dropdown, wishlist, basket, theme
toggle and a mobile panel. A Server Component composing client islands, so the
shell ships as markup.

**Footer.** Shop, support, company, social and newsletter.

**Home page.** Ten sections: hero, featured, brand strip, four category rails,
today's deals, why buy from Bondo, reviews, newsletter.

**Catalog pages.** `/products` with category and search filtering and a real
empty state; `/products/[slug]` with a grouped specifications table, breadcrumb
and related products, 12 routes prerendered. These exist because the home page
links to them — the project does not ship links to routes that 404.

**Controls without destinations open panels, not 404s.** Basket and wishlist
each open a sheet showing a genuine empty state; account is a disabled button
until sign-in exists (**K-2**).

### Changed

- `lib/routes.ts` gains `catalog.byCategory(slug)`. A category is a filtered
  listing rather than a separate template, so sorting, pagination and empty
  states are implemented once.
- The Phase 1 header and footer placeholders are replaced. Both were explicitly
  marked provisional in `PROJECT_STATUS.md`.
- Roadmap Phase 3 split into **3A** (this, mock data) and **3B** (services,
  auth, database), because the original bundled both and was blocked on K-3.
- Footer column headings are `h2`, not `h3`, and the catalog listing carries a
  screen-reader-only "Products" heading above the grid. Both close heading-level
  skips found by auditing the served HTML: the listing's only headings were the
  page `h1` and the cards' `h3`.

### Deliberate exemptions

- **ADR-36 refines ADR-20** to permit mock catalog data in `mocks/`, scoped so
  it cannot leak past `app/` and `components/`, with the empty states ADR-20
  protects built and reachable today. Tracked as **D-11** — the phase's main
  debt, deleted the moment services land.
- **No product photography.** A convincing fake photo of a real product is the
  one piece of mock data that could be mistaken for finished work, so products
  render a monogram tile instead. Consequence: `next/image` is unexercised
  (**D-12**).
- **No manufacturer or social logos.** Trademarked marks are not approximated;
  brands show a monogram and social channels are text.

### Added

- `docs/database/` — ERD, table relationships, permission graph, storage
  architecture, inventory flow and the product model, as Mermaid diagrams.
  Written from schema introspection rather than from memory, and cross-checked
  against `pg_catalog` so the counts cannot drift from the database.

### Investigated — no defect found

- **`ReferenceError: __dirname is not defined`** was reported against
  production. Audited all 138 text files by literal enumeration: `__dirname`
  and `__filename` appear in exactly one source file, `eslint.config.mjs`,
  where they are **local constants derived from `import.meta.url`** — the ESM
  replacement for the CommonJS globals, not a use of them — in a file loaded by
  ESLint alone and never deployed. The emitted Edge bundle contains **zero**
  occurrences; the seven elsewhere in `.next/server/` are Next.js's own
  ncc-bundled dependencies inside CommonJS chunks running in the Node runtime,
  where `__dirname` is defined. A fresh production build served `/`, `/nope`,
  `/account`, `/admin`, `/products`, `/cart`, `/sign-in` and an authenticated
  request without a single `ReferenceError`.

  No code changed, because nothing in this repository is wrong. The audit is
  recorded in `PROJECT_STATUS.md` under Edge runtime constraints specifically so
  that a future instruction to "remove every `__dirname`" does not delete the
  `eslint.config.mjs` lines and break linting — `FlatCompat` requires a
  `baseDirectory`.

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
  the first query. Now checked with `z.url({ protocol: /^https?$/ })` and an
  explicit scheme test in the preflight.
- **Regression, introduced and fixed within this same unreleased section:** the
  first attempt at the above used `z.httpUrl()`, which restricts the host as
  well as the scheme. That rejected `http://localhost:3000` — the fallback in
  `resolveSiteUrl()` — and `http://127.0.0.1:54321`, the local Supabase URL
  `.env.example` prescribes, so any build without `NEXT_PUBLIC_SITE_URL` and
  every local stack broke. Caught by testing the post-fix environment shapes
  rather than only the failing one. The scheme needed restricting; the host did
  not.
  A value carrying a trailing newline from a paste also passed every truthiness
  and length check, leaving the credential quietly wrong at runtime; it is now
  rejected rather than trimmed, so the mistake is fixed where it was entered.
- The preflight failure now **leads with a status line per variable**, so a
  truncated build log still answers "which one".
- **`500 MIDDLEWARE_INVOCATION_FAILED` on every request after a successful
  deploy** (ADR-35). `middleware.ts` reached `lib/env.ts`, which validates the
  entire public environment contract with Zod **at module scope and throws on
  failure**. In an Edge Function module scope is evaluated once per isolate, so
  a throw there takes down every request for the life of that isolate, and
  Vercel reports it only as `MIDDLEWARE_INVOCATION_FAILED` — no file, no line,
  no variable named.

  Two things made that reachable. `lib/env.ts` validated
  `NEXT_PUBLIC_SITE_URL`, which nothing in the middleware chain uses; and that
  variable was **unset at build**, so Next.js left it as a runtime
  `process.env` read rather than inlining it — a value the build never
  validated, since `next.config.ts` does not execute inside the Edge Function
  (**K-14**).

  `supabase/session.ts` now reads its two `NEXT_PUBLIC_*` values from
  `process.env` directly; both **are** inlined at build, so nothing is left to
  validate at runtime. The missing-value guard moved inside the request
  handler, where a failure costs one request instead of the isolate. Measured
  on the emitted bundle: **383 kB → 325 kB, Zod gone, the module-scope throw
  gone, and the `NEXT_PUBLIC_SITE_URL` runtime read gone.** `lib/env.ts`
  remains the contract for every other consumer.

- **`The Edge Function "middleware" is referencing unsupported modules`**
  (ADR-34). Vercel resolves the middleware import graph itself when packaging
  the Edge Function — from source, transitively, and **without applying tsconfig
  `paths`** — so every `@/` import reachable from `middleware.ts` was reported
  as a missing module. Every module in that chain now imports by relative path.
  Proven rather than assumed: converting only the entry moved the error one
  level down, from `middleware.js: @/supabase/session` to
  `supabase/session.js: @/lib/env, @/lib/routes`. The full graph was then walked
  — 5 modules, zero aliased imports remaining, only npm specifiers left. Two
  earlier hypotheses were tested and **disproved** first: Turbopack's output
  shape, and a missing tsconfig `baseUrl`.
- Diagnostics from the earlier attempt, kept because they were correct on their
  own terms (ADR-33). Vercel's Edge bundler expects `.next/server/middleware.js`.
  `next build --turbopack` never emits that file — it emits three chunks, one
  named `[root-of-the-server]__….js` — so Vercel could not assemble the function
  and reported the alias as an unresolved bare module. The alias itself was
  fine: a literal scan of all 195 emitted files found no occurrence of it.
  The production build now uses webpack; `dev` keeps `--turbopack`, where the
  speed matters and nothing is deployed. Measured side effect: **First Load JS
  139 kB → 103 kB, middleware 162 kB → 109 kB.** Tracked as **K-12** so it is
  retested rather than assumed permanent.
- **`Error: Unhandled type: "ColonToken" :` on Vercel.** Latent since Phase 1 and
  only reachable once the build got far enough to be analysed. Vercel reads
  `middleware.ts` with `@vercel/static-config`, which pulls each property apart
  positionally — `const [nameNode, _colon, valueNode] = prop.getChildren()`. A
  JSDoc block attached to a property becomes an extra leading child, so those
  names land on `[JSDoc, name, colon]` and the parser receives the colon as the
  value. The `/** … */` comment above `matcher:` moved outside the object
  literal; the reasoning it carried is preserved, with the constraint recorded
  at the site so it is not reintroduced. Reproduced against the real parser
  before and after the change.

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
