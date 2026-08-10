# Changelog

All notable changes to Bondo are recorded here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Until v1.0.0 the minor version tracks the phase: v0.1.0 is Phase 1, v0.2.0 is
Phase 2, and so on. v1.0.0 is the production launch at the end of Phase 9.

---

## [Unreleased]

### Fixed — an unknown product URL answered 200 instead of 404

`/uz/products/does-not-exist` returned **200** with "we could not load the
catalog". Two independent causes, both measured on a production build
(**ADR-81**):

1. **`catalog.reads.getProductBySlug` threw instead of returning `null`.** Its
   signature said `Promise<Product | null>`, but `productsService` raises
   `notFoundOrForbidden` for a missing row and the facade passed it straight
   through — so the page's `if (!product) notFound()` never ran. `readCatalog`
   caught the `AppError`, logged "page read failed" and rendered
   `CatalogUnavailable`. The status was wrong _and_ the message blamed the
   shop's infrastructure for a typo in a link. Only `not_found` is converted; a
   `forbidden` or a connection failure still throws, because those really are
   "the catalog is unavailable".

2. **`products/loading.tsx` opened a Suspense boundary above `[slug]`.** A
   `loading.tsx` covers its segment _and every route beneath it_, so the
   response shell flushed with 200 before the page body ran and `notFound()`
   could no longer set the status. It moved into a `(listing)` route group,
   which is URL-transparent: `/products` is unchanged, the listing keeps its
   skeleton, and the detail route is simply outside the boundary.

Both were necessary. Fixing only the read left the status at 200; putting the
`loading.tsx` back reproduced the 200 with `notFound()` firing, which is
**ADR-41**'s mechanism — that guard had been dropped when the route moved to
on-demand rendering, and ADR-81 replaces it structurally.

Verified on `next start`: `/uz`, `/ru` and `/en` product URLs for unknown slugs
all return **404**, and the listing, filters, home page and information pages
all still return 200.

### Changed — the admin panel manages the real catalog

Products, categories and brands all persist to the connected Supabase project.
An administrator signs in, creates a product, uploads an image, publishes it,
and a shopper sees it.

**Why the panel said "Qisman ulangan".** Three things, not one: the shell
rendered a hand-written banner unconditionally; seven controls called a
`notSaved()` helper that raised a toast and wrote nothing; and the product pages
read `mocks/admin` and `mocks/catalog`, with the editor bound to a type built on
the storefront's `Product` — carrying `rating`, `stock` and `badges`, none of
which an administrator can write. That was **D-29**, the same class as **K-15**:
a form designed against an imagined schema.

Connected this pass:

- **Product list** — `listProducts`, all statuses, real counts, real filters.
- **Product editor** — `AdminProductDraft`, every field a column; `saveProduct`
  on submit, and the result decides what the operator is told.
- **Publish / unpublish** — from the row menu and the editor, through
  `saveProduct` rather than a second write path.
- **Delete / restore** — soft delete plus a **new** `restoreProduct` action.
- **Specifications** — **new** on `saveProduct`, via `replaceSpecifications`.
- **Product images** — **new** upload, delete, set-primary and reorder actions
  over Supabase Storage. Uploads survive a refresh; nothing lives in browser
  state.
- **Brand create** — the manager had edit and delete but no way to add one.
- **Command palette** — products, categories and brands from the database.

The banner is now **derived** from a `persistence` field on each module record
(**ADR-80**). It names only the modules still on fixtures — inventory,
homepage, content pages, users, settings — and renders nothing when there are
none.

### Fixed — a new product could not be saved at all

`assertPublishable` demanded a price, a category and a brand on **every** write,
including `status = 'draft'`. The first Save of a new product failed with "This
product is not ready to publish", which is also what the operator saw when they
had typed only a name. A draft is allowed to be incomplete — that is what draft
means. The guard now returns early unless the product is going active, and its
message names what is missing.

### Fixed — a soft-deleted product could not be restored

`getProductById` filtered `deleted_at is null`, so a deleted product could not be
opened and `restoreProduct` was unreachable from the only screen that offers it.
It now takes `includeDeleted`, which the admin editor passes and the storefront
does not.

### Changed — the catalog listing, rebuilt around an information architecture

The listing rendered one filter chip per category: every level in identical
pills, above every result. Capping it at twelve departments last pass fixed the
height; it did not fix the fact that nothing on the page told a shopper which
level they were looking at. Four levels now look like four levels.

| Level       | Component        | Treatment                                         |
| ----------- | ---------------- | ------------------------------------------------- |
| Department  | `CategoryNav`    | Bordered chips with icons, one active state       |
| Subcategory | `SubcategoryNav` | Lighter text links, **only** when in a department |
| Filter      | `CatalogFilters` | A sidebar on desktop, a sheet on a phone          |
| Product     | `ProductGrid`    | The grid                                          |

**Desktop:** five departments inline, the other seven behind a "Yana / Ещё /
More" disclosure, so the row stays one line at every width. The disclosure is
`<details>` — no JavaScript, keyboard operable, announced without ARIA — which is
what keeps the primary navigation server-rendered.

**Mobile:** all twelve in a scroller that scrolls _inside itself_, so the page
never widens. The sidebar is not stacked above the products; the same panel
opens in a sheet from `[Filtrlar]`, beside `[Saralash]`.

**Filters are not categories.** Price, brand and on-sale, each backed by a real
column (**ADR-79**). Availability and specification facets are deliberately
absent — this shop does not maintain stock levels, and specs are free-text — and
so is sorting by name, because a product's name is on a to-many translation row
PostgREST cannot order a parent by. A control that changes the URL without
changing the result is worse than an absent one.

**The URL is the state** (**ADR-78**). `lib/catalog/search-params.ts` owns the
encoding; the page reads `searchParams`, queries and renders. Every filter is
shareable, bookmarkable and survives the back button, and the listing stays a
Server Component with two client islands.

Also: a breadcrumb, exact result counts from the database, active-filter chips
that each remove one filter, pagination, and a compact empty state that no
longer promises products are coming.

| Measured                       | Before           | After                    |
| ------------------------------ | ---------------- | ------------------------ |
| Category navigation height     | 424px, 102 chips | **49px**, 12 departments |
| Nav + subcategory + breadcrumb | 424px            | **154px**                |
| Empty state                    | 294px            | **238px**                |

### Fixed — the filter panel emitted duplicate element ids

It renders twice, in the sidebar and in the mobile sheet, and both used the same
`id` values. Radix keeps sheet content mounted after its first open, so once a
shopper had opened the drawer, `<Label htmlFor>` resolved to the **first** match
in the document and a label tapped in the drawer toggled the checkbox behind it
in the sidebar. Scoped with `useId()`; the production HTML now has zero duplicate
ids.

### Added — the five business-information pages

Delivery, warranty, returns, contact and about, at `/delivery`, `/warranty`,
`/returns`, `/contact` and `/about` in all three languages. These are the pages
the footer has been unable to link since Phase 3A, because `content_pages`
existed and held no rows.

**The copy is database rows, not JSX.** Every page body is a
`content_page_translations` row shipped by
`20260817001000_business_information_pages.sql` and editable from the admin
without a deploy. `messages/info.json` holds only chrome — "Need a hand?", the
contact card's field labels (ADR-39).

Bodies are plain text in a three-rule syntax — `## ` heading, `- ` list item,
blank line between paragraphs (**ADR-76**). Not HTML, which would mean rendering
database markup through `dangerouslySetInnerHTML`; not Markdown, which would mean
a parser and a sanitiser for three block types.

**Only the business's own information is published:** the carriers, the 24-hour
preparation window, the three-day delivery estimate, that delivery is charged
separately and quoted on the confirmation call, that PCs are assembled in house,
and the one-year warranty.

**Nothing else was written** (**ADR-77**):

- Returns states that the policy is not finalised and asks the customer to get
  in touch — no window, no refund terms.
- Warranty gives the term and says the detailed conditions are not published.
- Privacy and terms have no row, no route and no footer link.
- The contact card renders only configured settings. All five are currently
  null, so it says so and shows no number, address or hours.

Four new settings keys — `store.phone`, `store.telegram`, `store.address`,
`store.hours` — declared public and **null**, following `store.support_email`. A
null row is the field existing and being unconfigured, which is what lets the
page say "not set up yet" instead of a developer guessing a phone number.

Written Uzbek-first and then adapted independently: the section counts, headings
and sentence shapes differ between the three, and the carrier list is bullets in
Uzbek and a sentence in Russian.

### Fixed — `/checkout` had been answering 500, and nothing noticed

`i18n/messages.ts` enumerates the namespaces it imports; `check-translations.mjs`
walked the `messages/` directory. Two lists, and they had drifted: `checkout` and
`adminHighlights` both had all three locale files, so every translation check
passed, while the loader never imported them and
`useTranslations("checkout")` threw `MISSING_MESSAGE`. The checkout page was
returning **500**. It survived because the route is behind a redirect and nothing
had opened it in a browser since it was written.

Both are now loaded, and the checker asserts the two lists agree in **both**
directions — verified by removing an entry and watching it fail.

### Changed — the footer links the pages it has been describing

Four columns: brand, departments, **Yordam** (delivery, warranty, returns,
contact) and **Kompaniya** (about, account, orders). Every entry resolves — 18
return 200 and the six account links correctly 307 to sign-in. Still 314px at
1280px, still no client JavaScript.

### Fixed — the page was 54,246px tall, and the footer was 2% of it

The brief was "the footer is too tall". Measuring first said otherwise: at
1280px the home page document was **54,246px** and the footer was **870px**.

**The cause was two uncapped loops meeting the new taxonomy.** The home page
rendered one section per category and the listing rendered one filter chip per
category. Both were written for twenty categories and survived the jump to 102
without being re-measured: 102 empty sections of ~494px each, 102 product
queries — one per rail, each re-fetching the whole category list first — and a
424px filter strip above every listing.

Both now derive from the navigation tree instead of the flat list (**ADR-75**).
The home page takes at most six **departments** and skips any with no products,
so an empty catalog fetches nothing and renders no rails. The listing offers the
twelve departments plus one level of narrower filters. `catalog.reads` memoises
the raw category read per request, collapsing the duplicate fetches into one.

| Measured at 1280px   | Before   | After       |
| -------------------- | -------- | ----------- |
| Home page document   | 54,246px | **3,323px** |
| Home page sections   | 108      | **6**       |
| Listing filter strip | 424px    | **64px**    |

Nothing was hidden to get there. An empty rail has no content by definition, and
every category is still reachable from the mega menu, the mobile accordion, the
footer and the listing's filter strip.

### Fixed — the site claimed a three-year warranty and a one-year warranty

The footer said three years; the home page's service highlights — real database
rows — say one. The shop contradicted itself on its main trust claim, in all
three languages. Every warranty string is now **one year**, including the hero's
eyebrow and its assurance row.

### Fixed — signing in from a protected link landed on a 404 (**K-24**)

Middleware stored `redirectTo` **with** its locale prefix while every consumer
treats the value as unprefixed: `signInAction` hands it to `router.push()` from
`@/i18n/navigation`, which prefixes whatever it is given, so `/uz/account`
became `/uz/uz/account`. Sign-in itself succeeded, which is why it read as a
broken link rather than a broken login. `supabase/session.ts` now stores the
path from `splitLocale()`, matching `lib/routes.ts` and `lib/auth/guards.ts`.

### Changed — the footer, rebuilt compact and honest

Three blocks on a twelve-column grid — brand 4, departments 5, account 3 —
collapsing to three equal columns at `sm` and to two `<details>` disclosures on a
phone. Still a Server Component shipping no client JavaScript.

| Footer height | Before | After     |
| ------------- | ------ | --------- |
| 1280px        | 870px  | **314px** |
| 768px         | 546px  | **426px** |
| 375px         | 523px  | **364px** |

**Removed, because each showed a visitor something untrue:** the newsletter form
(no endpoint records a signup), four hardcoded social "links" for accounts that
do not exist, and eight inert grey rows plus a footnote apologising for the
support and company pages. `content_pages` exists and has no rows — writing
delivery windows, warranty terms and a returns policy is the business's job, and
inventing them would be the fake content ADR-20 forbids. They return as links the
day the pages have copy.

Link rows are **44px on touch, 32px from `sm`**. The previous `py-1.5` carried a
comment claiming it made a 44px target; 20px of line box plus 12px of padding is
32px, and the claim had been in the file since the last footer pass.

### Changed — `butlovchi qismlar` → `kompyuter qismlari` in Uzbek

At the business's request, and applied where it is read: the footer, the catalog
and home metadata, and the components department itself
(`20260816001000_component_category_wording.sql`). Guarded so a category an
operator renamed keeps their name, and the slug is untouched so no URL moves.
Russian keeps «Комплектующие» and English keeps "PC components" — the ban is on
an Uzbek word, not on the concept.

### Added — the category system, redesigned as a real retail hierarchy

**A twelve-department tree, 102 categories, none of them hardcoded.**
`20260815001000_category_taxonomy.sql` replaces the flat twenty of ADR-68 with
the hierarchy the business sells from: 12 departments and 90 subcategories, in
Uzbek, Russian and English, with a slug and SEO copy per locale (**ADR-72**).

Written three times from the business meaning rather than translated once —
`Videokartalar` / `Видеокарты` / `Graphics cards`, `Quvvat bloklari` /
`Блоки питания` / `Power supplies`. SSD, HDD, NAS, USB, HDMI, DisplayPort, VGA,
LAN, Wi-Fi, Bluetooth, RGB, MacBook, Windows and Microsoft Office are spelled the
same in all three, because a shopper searching for one will not find a
transliteration of it.

The old twenty are **removed, not re-parented**: several change meaning in the
new tree, and a database holding half of each design is one nobody can describe.
The removal is guarded three ways — untouched Uzbek slug, no products filed
against it, no children — so an operator who renamed or used one keeps it.

**Two levels is the data, not the limit.** `parent_id`, the trigger-maintained
`path` and the cycle rejection have supported unlimited depth since Phase 2. The
tree builder, both storefront menus and the admin tree are all recursive; the
schema assertions prove a third level nests at depth 2 and that a cycle is still
refused at any depth.

**Two new columns.** `categories.icon` is a lucide name validated for shape by a
check constraint and for membership by the Server Action, against the same map
the storefront draws from (ADR-69, extended by **ADR-72**). `categories.is_featured`
promotes a subcategory into the mega menu's "Popular" row.

**A desktop mega menu.** One trigger, a two-pane panel: departments down the
left, the hovered one's subcategories on the right, with its icon, image,
description and featured chips. Every panel is in the DOM as `hidden` rather
than mounted on demand, so the server HTML carries **114 category links** before
any JavaScript runs.

**A mobile accordion** of unlimited depth, built on `<details>` so it opens on
the first tap instead of after hydration. 12 top-level rows, all closed by
default, every row 44px.

**A full admin module.** Create, create-beneath, change parent, drag & drop
ordering _and_ re-parenting, hide, show, feature, icon picker, image upload,
three-language name/slug/description, the shared SEO panel, and delete —
refused, with a sentence, while the category still has children. Every movement
has a keyboard equivalent (Up · Down · Indent · Outdent) per WCAG 2.2 SC 2.5.7.

**The category image uploader is the first admin control that reaches Storage.**
Uploading returns a path and does not save; the operator's Save commits it, so
an abandoned form leaves the category untouched.

**Depth costs nothing.** The whole navigation is **two** requests per render —
one for every category with all its translations embedded, one for product
counts — nested in memory and memoised per request. No query per level, no query
per category, no N+1.

### Fixed — two defects the flat taxonomy had been hiding

- **Categories were ordered by random UUIDs.** `listCategories` sorted by
  `(path, display_order)` and `path` is a `uuid[]`. Invisible while the list was
  flat and unarranged; the moment the departments had a business order the header
  rendered them shuffled. Now `(depth, display_order)`. Caught by reading the
  rendered menu.
- **A department listing returned no products** (**ADR-74**). Products are filed
  against a leaf, so filtering by a department's own id matched nothing and all
  twelve top-level links led to an empty shop. `listProducts` now resolves the
  subtree from `path` and filters with `in`.

### Changed — categories and the audit log now read and write the real database

**Categories is wired end to end.** The page reads `categories` with real
product counts and the manager's create, save, delete and reorder call the
Server Actions. Rebuilding it around the database's shape surfaced three things
the fixtures had been hiding:

- it was **keyed by slug**, which works only while the slug never changes — a
  real one is editable, and keying a list on a field the form can edit is how a
  row loses its identity mid-edit. It is keyed by `id` now.
- the **slug input could only ever write one language**. `category_translations`
  has a slug per locale (ADR-52), so it is a `LocalizedField` like the name.
- **`icon` and `parentSlug` had no columns.** Parent is `parent_id`; there was
  never an icon.

**The audit log reads `audit_logs`.** Its "summary" column was **removed**
rather than reproduced — there is no such column and there should not be. An
audit row records what happened in machine terms, and prose about it would be a
second, editorialised copy of the same fact. `ACTION_TONE` became a partial
lookup with a fallback because `action` is free text, so an action written by a
future migration renders neutrally rather than crashing the table.

**Three of ten admin modules are now connected**: brands, categories, audit.
Products, media, homepage, settings, users, inventory and content pages still
read fixtures, and PROJECT_STATUS carries a per-module table saying so.

Two of those cannot be wired without new work rather than more wiring: homepage
sections have **no table** (they are declared interface vocabulary, so
connecting them starts with a migration), and users has **no service** — there
is nothing that lists customer profiles for staff, and the existing fixture is
of administrators, a different table.

`npm run admin:verify` still passes 23/23 against the hosted project.

### Changed — the admin writes to the real database

`actions/catalog.actions.ts` adds Zod-validated, permission-guarded Server
Actions over the existing services for brands, categories and products — create,
update, soft delete, and category reordering — each revalidating the storefront
so a product published in the panel appears in the shop without a deploy.

**Brands is wired end to end.** The page reads the `brands` table with real
product counts, and the manager's save and delete call the actions. The list is
no longer local state that gets patched in memory and toasted "nothing was
saved": the action writes, revalidates, and the server returns the row.

**Proven live, through RLS.** `npm run admin:verify` mints a throwaway
administrator, signs in with the **public anon key**, and runs every write
through that session — because a service-role script proves the schema accepts a
row and nothing else, and `has_permission()` is the layer most likely to refuse.
**23/23 passed** on the hosted project: brand/category/product create, read,
update and soft delete; three translation rows each; publishing; an anonymous
storefront read that sees a published product and does **not** see a draft; a
PNG uploaded to the `products` bucket and fetched back over HTTP 200; and a
signed-in customer refused a brand insert with `42501`.

Removing the mock layer from brands surfaced two fields with **no column behind
them**: `website` was fabricated from the slug, `isFeatured` was "the first four
rows", and a localized description input wrote nowhere at all. The description
control is removed rather than left silently discarding what an operator types.

The banner now says brands are live and the rest are not, instead of one blanket
"changes will not be saved" that is wrong either way. It comes out when the last
module is wired.

**Still on fixtures:** products, categories, inventory, content, homepage,
settings, users and audit. The actions for products and categories are written
and tested — those two are a manager rewrite away, not an architecture away.

Also pushed the three pending migrations, so the hosted project is at 20 and
matches the committed types.

### Added — the customer order experience, and two more ownership paths

**Phase 4B — the customer flow.** `/checkout` (guest-only, delivery or pickup,
first/last name, two phone numbers, region, district, Telegram, notes and an
optional email), `/checkout/success` with the account invitation, and
`/account/orders` plus `/account/orders/[id]` with a status timeline and
review gating. The basket is wired end to end. `20260813001000` added the
columns the form needed, because the schema comes before the screen (§ 12).

**Phase 4C — the ownership hierarchy.** An order now gets an owner in exactly
one of three ways, ranked by the strength of the proof:

1. **Claim token** (ADR-70, unchanged) — the caller _is the browser that placed
   the order_. Tried first, always.
2. **Verified email** (**ADR-71**) — the caller _controls the mailbox the order
   was placed with_. Sweeps what the token did not.
3. **An administrator, by hand** — no automatic proof; a human is named in the
   audit log.

ADR-71 is not phone matching with a different column. A phone number is not a
secret; a **confirmed** mailbox is proof, and the check is
`email_confirmed_at is not null` read at call time rather than trusted from a
JWT issued earlier. Without that line the path would let anybody register with
any address and take the orders under it — so it is the whole security of the
mechanism, and it is asserted directly.

**Every ownership change is now audited.** All three paths call
`log_order_ownership`, which writes an append-only row recording the method and
the actor — immutable even to `service_role` (ADR-27). For the manual path the
actor is the administrator and the recipient is the customer, which is the one
case where they differ.

**No path overwrites an owner**, including the administrator's. Asserted: a
stranger with a guessed token, a second verified account on the same address,
and an administrator attempting reassignment all claim **0**.

The status enum kept `contacted` rather than becoming
`awaiting_customer_confirmation`. The label and its explanation already say what
the longer name describes, and renaming an enum in a live database to restate
copy is churn.

`db:verify` grew from 143 to **162 assertions**.

**Not built:** the admin "Link Order to Customer" button and the guest-vs-
registered badge — both need the admin orders module, which does not exist and
is held out of the registry so the sidebar cannot link to a 404. Also
outstanding: registration pre-fill from the order, and the review form itself.

A build failure worth recording from 4B: a `"use server"` module compiles with
the rule that every top-level function is async, and SWC applies it to every
function expression in an exported initializer — including the arrow passed to
Zod's `.refine()`. Inlining a schema inside `createAction` failed the build
pointing at the predicate. Hoisting the schema fixes it.

### Added — guest orders can be claimed by a new account

A shopper orders as a guest, registers afterwards, and the order they already
placed appears in their history. **The same row, moved — never copied.**

**The security decision is the feature** (**ADR-70**). The obvious implementation
is "claim every order whose phone matches the new account", and it is a
data-disclosure hole: a phone number is not a secret, so anyone who knows a
customer's could register with it and read that customer's name, delivery
address, basket and totals. Matching the order reference is worse, because
`BND-001042` is sequential by design so a manager can read it down the phone.

So a claim requires proof that the claimant placed the order, and the only party
holding that proof is the browser that placed it:

- `place_order()` issues `claim_token` — random, and **only** for guest orders.
- The token goes into an **httpOnly cookie** and is never returned to the
  browser, never put in a URL, never logged. A capability in a response body ends
  up in an analytics payload or a screenshot.
- `claim_orders(uuid[])` moves ownership where the token matches **and** the
  order is still unowned, then spends the token. Single use, idempotent, bounded
  to twenty, and refused outright to anonymous callers.
- Claiming runs where a session first exists: after the email verification link
  is exchanged, and after any sign-in — so "Maybe later" followed by signing in a
  week later works identically.
- It **never throws**. A failed claim must not turn a successful verification
  into an error page; it logs loudly instead.

The trade is that a guest who clears cookies loses the automatic link. That fails
in the safe direction — they still have the order, the shop still has their phone
number, and support attaches it by hand.

`db:verify` grew from 126 to **140 assertions**, eleven of them this feature,
including the attacks it exists to refuse: a stranger with a guessed token claims
nothing; a replayed token claims nothing; a spent token cannot move an owned
order to somebody else; the reference does not change and no duplicate order is
created; an order placed while signed in gets no token at all; an anonymous
caller cannot claim; and the claimed order is readable by its new owner under
RLS.

**The screens are not built.** The flow cannot be walked in a browser, because it
starts at a checkout that does not exist — `/checkout`, `/checkout/success`
with its account invitation, registration pre-fill, `/account/orders` and the
"Leave a review" button are all outstanding (**D-30**, **D-31**). What landed
here is the mechanism underneath them, and it is proven.

### Deployed — the last three migrations are live

`supabase db push` applied `20260809001000_orders_and_reviews`,
`20260810001000_default_categories` and `20260811001000_service_highlights` to
`pgxqnezwrwfgrmamlxhs`. The project now carries **all 17 migrations and 36
tables**, matching the committed types; `supabase migration list` reports zero
pending.

Verified afterwards through the **anonymous** client rather than the service
role, so what follows is what a real visitor gets through RLS:

| Check                                             | Result                      |
| ------------------------------------------------- | --------------------------- |
| 20 default categories readable                    | ✅                          |
| 6 service highlights, visible, three languages    | ✅ `3,3,3,3,3,3`            |
| warranty card's written titles                    | ✅ uz / ru / en all present |
| `orders` exists and anon is refused               | ✅ 0 rows                   |
| `product_reviews` exists and is publicly readable | ✅                          |

**And the storefront was checked in a browser**, which closes the caveat carried
by the previous two entries. The service highlights render six cards with icons
directly under the hero, in position 1 of the page's sections, in Uzbek and
Russian, one column at 320px with zero horizontal overflow. The twenty
categories now drive the home page's category rails and the footer's shop
column — every heading on the home page is a real category read from the
database.

Nothing in the application changed for this; it is a deployment entry.

### Added — service highlights, editable from the admin

The trust row under the hero: six promises a shopper reads before deciding
whether to buy from a shop they have not used. Warranty, build time, delivery,
who assembles the machine, whether it is tested, whether the parts are genuine.
Each one is a commitment somebody could hold the shop to, which is the only kind
of claim worth putting there.

**None of it is hardcoded.** `20260811001000_service_highlights.sql` creates
`service_highlights` and `service_highlight_translations`, seeds the six
defaults in Uzbek, Russian and English, and an operator manages them from
`/admin/highlights`: add, edit, delete, drag to reorder, hide, change the icon,
edit every language. The old `ValueProps` component and its four claims in
`home.valueProps` are deleted.

The copy lives on the record rather than in `messages/` — ADR-39 applied. "1
yillik kafolat" is the shop making a promise, not the interface labelling a
button. Only the section heading stayed in `messages/`, because that is chrome.

**The icon is a lucide name, not an upload** (**ADR-69**). Stored as text,
resolved by an explicit map, and validated against that same map in the Server
Action so the picker and the storefront cannot drift. A check constraint enforces
the identifier shape; the action enforces membership. Not a database enum, which
would make adding a glyph a migration.

No permission was invented: highlights are storefront content with the same
lifecycle and author as banners, so they reuse `banners.read` and
`banners.manage` (ADR-44 holds).

Two interaction decisions worth stating. **Reordering saves immediately** —
dragging a row and then having to press Save is how an operator loses an
arrangement they thought they made — and the list is optimistic, reverting with a
toast if the action refuses. **The edit dialog saves on submit**, because
half-typed copy in three languages must not reach the storefront between
keystrokes. **All three languages are required** by the schema, not merely
encouraged: a highlight missing its Russian renders a gap for every
Russian-reading visitor.

`db:verify` grew from 119 to **126 assertions** — the six defaults exist, each in
three languages, in order and visible; the warranty card carries its three
written titles; an icon that is not an identifier is refused; deleting a
highlight cascades its copy; and the seed does not resurrect a deleted one.

**Not seen rendering with real rows.** The dev server points at the hosted
project, which has none of the last three migrations, so the read fails and the
section is absent. That path was exercised and behaves as designed — logged at
`error`, page intact, no layout shift — but the populated section is proven by
assertions, typecheck and build rather than by looking at it.

### Removed — the admin dashboard's fake analytics

A dashboard whose numbers are decoration is worse than no dashboard: it is the
one screen an owner checks before deciding something, and a plausible fake
number is indistinguishable from a real one until a decision has been made on
it. The page used to render a generated 30-day revenue series, a generated order
series, two charts over them, a customer count, a units-on-hand total and a
low-stock list — all from `mocks/admin.ts`, under a banner admitting the figures
were illustrative.

Every figure now comes from a query, or is gone:

| Widget                            | Now                              |
| --------------------------------- | -------------------------------- |
| Waiting on a call                 | `orders` at `new`                |
| Orders                            | `orders` count                   |
| Revenue                           | sum of **delivered** orders      |
| Products                          | `products` count                 |
| Latest orders                     | `listOrders`, seven rows         |
| Recent activity                   | `audit_logs`                     |
| Revenue and orders charts         | **deleted**                      |
| Customers                         | **deleted**                      |
| Units on hand, low stock          | **deleted**                      |
| Pending reviews                   | **deleted**                      |
| "Figures are illustrative" banner | **deleted** — they no longer are |

Revenue counts **delivered orders only**. Bondo settles at the door (ADR-63), so
money is taken when an order arrives, not when it is placed; booking a `new`
order as revenue would count a phone call nobody has made.

The charts went rather than getting a real data source because nothing records a
daily series. That needs either thirty days of orders or a rollup table, and
until one exists the honest thing is to draw nothing. "Customers" went for a
different reason: it counted fixtures, and most orders are placed by guests, so
the figure needs a definition before it needs a widget.

**The notification bell and two command-palette groups went with them.** The bell
rendered three fixtures — a low-stock warning, a new order, a scheduled publish —
corresponding to nothing; the schema has no notification source, so it is empty
until it does. The palette no longer lists customers or orders, because a search
that answers confidently and wrongly is worse than one that does not cover a
resource yet.

Each widget now degrades independently: a failed read logs at `error` and costs
that panel rather than the page. That matters because the orders migration has
not been pushed to the hosted project yet.

**A live bug fell out of this.** `adminDashboard.orderStatus` still held the old
payment vocabulary — `pending`, `paid`, `fulfilled`, `refunded` — while
`OrderStatus` became `new … delivered` two changes ago. Every order status badge
would have rendered a raw translation key. `npm run i18n:check` cannot catch it:
it compares the locales against each other, and the key was equally wrong in all
three. Now `new`, `contacted`, `confirmed`, `preparing`, `shipped`, `delivered`,
`cancelled`, written in each language.

**No bundle change**: the dashboard is 134 kB First Load JS, exactly as before.
The charts were server-rendered SVG (ADR-6), so deleting them saved no client
JavaScript — only the fiction.

### Added — the shop's real category taxonomy

**`20260810001000_default_categories.sql`** seeds the twenty categories the
business actually sells, in all three languages: Noutbuklar, Tayyor
kompyuterlar, O'yin kompyuterlari, Protsessorlar, Videokartalar, Ona platalar,
Operativ xotira, SSD, HDD, Quvvat manbalari, Kompyuter korpuslari, Sovutish
tizimlari, Monitorlar, Klaviaturalar, Sichqonchalar, Quloqchinlar, Printerlar,
Router va tarmoq uskunalari, Server uskunalari, Aksessuarlar.

**A migration, not `seed.sql`** (**ADR-68**). ADR-20 forbids _fake_ data, and a
taxonomy is not fake — it is the shop's own, decided by the business, and a
computer store that sells laptops has a Laptops category on the day it opens. It
belongs with the roles and permissions inserted the same way in Phase 2.
`seed.sql` is development fixture data and never runs on `db push`, so anything
a fresh deployment cannot function without has to be a migration.

Each category gets a slug per locale — `noutbuklar` / `noutbuki` / `laptops` —
which is why `slug` lives on `category_translations` rather than the parent. SSD
and HDD are spelled the same in every language, and the migration asserts it.

Inserted flat, because that is the list the business gave. Nesting has worked
since Phase 2 (`parent_id`, a trigger-maintained `path`, cycle rejection) and an
operator can nest any of these from the admin without a migration — inventing a
hierarchy nobody asked for is the speculation § 3 rules out.

Idempotent, keyed on the Uzbek slug: re-running changes nothing, and an operator
who renamed a category keeps their name.

The seed's own category fixtures collided on six slugs and are now prefixed
`demo-`, which also makes fixture data visible at a glance in any database.

### Removed — the last fake data on the storefront

- **Fake customer reviews.** The home page rendered three invented reviews from
  `mocks/catalog.ts`. It now reads `product_reviews`, which only accepts a row
  from a customer whose own order containing that product reached `delivered`
  (ADR-66) — so every review on the site was written by somebody who bought the
  thing. Until one is, the section **renders nothing at all** rather than an
  empty state: a heading reading "what customers say" above an empty box
  advertises that nobody has said anything.
- **Fake product ratings.** Twelve mock products carried ratings like `4.8` and
  `214` review counts. Zeroed.
- **The `low-stock` badge.** It read a stock level to tell a shopper to hurry.
  This shop does not track stock, and a badge derived from a number nobody
  maintains is a lie with a countdown on it. `bestseller` stays — `is_featured`
  is a real column an operator sets deliberately.

`Review` changed shape to match the schema: `title` and `body` are plain strings,
not `LocalizedText`. A review is something a person wrote in the language they
wrote it in, and translating it would put words in their mouth. The `verified`
flag is gone because there is nothing to flag — every row that exists is a
verified purchase by construction, so the badge is unconditional and honest.

### Fixed — horizontal scroll at 320px, and a footer 1.3 screens tall

Both were measured in a real browser before anything was changed, and measured
again after. Neither was diagnosed by reading the code.

**The page scrolled sideways at 320px.** `document.scrollWidth` was 355 against a
`clientWidth` of 320 — 35px of overflow on the home page. The source was the
reviews grid: a grid item defaults to `min-width: auto`, which refuses to shrink
below its content's min-content width, and the product name under each review
carries `truncate` — whose `white-space: nowrap` set that min-content to 193px.
The card measured 339px inside a 288px column and pushed the document wider than
the viewport.

Fixed with `min-w-0` on the grid item and `break-words` on the review prose.
**35px → 0.** The same `min-width: auto` trap is latent in any grid whose cards
contain a `truncate`, so the comment at the fix says what to look for.

**The footer was 1062px tall at 320px** — 1.33 phone screens of links under every
page. Redesigned: the brand block is compact, the three link groups and the
newsletter collapse into disclosures closed by default, and the bottom bar lost
a `<Separator />` plus its 64px of margin in favour of a `border-t` and 20px.
Desktop keeps its columns unchanged in substance. **1062px → 543px, −49%**, and
0.75 screens rather than 1.33.

The disclosures are `<details>`/`<summary>`, not the Radix Accordion primitive.
Radix is a Client Component, and the footer renders on every page of the site —
using it would have added a hydration root to animate four triangles. `<details>`
opens with no JavaScript, is keyboard operable and correctly announced with no
ARIA, and works if hydration never happens. It cannot be forced open by CSS at a
breakpoint, so the group markup is rendered twice with the link list shared
between them; that trade is written up at the component.

Footer link rows gained `py-1.5`, taking a 20px text line to a 44px touch target
without loosening the desktop column.

**No bundle change.** First Load JS is 143 kB on the home page, exactly as
before — the footer was already a Server Component, so nothing moved off the
client. Removing `<Separator />` took one Radix component out of the footer's
tree, but `MobileNav` still imports it on every page, so the shared chunk is
unmoved at 103 kB. Claiming an improvement here would be inventing one.

### Added — orders and reviews, without a payment gateway

Bondo does not take money online, so this is not a checkout with the payment
step removed. `order_status` tracks a **conversation** — `new → contacted →
confirmed → preparing → shipped → delivered`, plus `cancelled` — because that is
what a manager ringing a customer back actually does (**ADR-63**). No `paid`, no
`refunded`: cash settles at the door, and a status nobody updates is worse than
no status. `orders.phone` is required and email is not collected at all.

**`20260809001000_orders_and_reviews.sql`** — `orders`, `order_items`,
`order_status_history`, `product_reviews`; the `order_status` enum; a reference
sequence; ten RLS policies; two permissions (**ADR-67**).

Three properties carry the design:

- **Nothing writes an order directly.** `place_order()` is `security definer` and
  no role holds insert on `orders` or `order_items` (**ADR-65**). It accepts a
  basket and **no prices** — every line is priced from the catalog inside the
  transaction that writes it. That closes three holes at once: a client-supplied
  total, a half-written order, and a guest appending lines to another guest's
  order, which a table-level insert policy could not prevent because a guest
  order has no owner to check.
- **The timeline writes itself.** A trigger appends to `order_status_history`
  inside the same transaction as the update, and the table carries the
  append-only guard — the argument ADR-24 makes for stock, applied to a workflow.
- **The review gate is an RLS policy** (**ADR-66**). Verified buyer, delivered
  order, one per purchased product — all three in a `with check` containing the
  join they depend on, so the rule survives the next Server Action somebody
  writes in a hurry.

**The cart is client-side and there is no `carts` table** (**ADR-64**), reversing
the roadmap's Phase 4 plan. Server carts existed to survive a redirect to a
payment provider; there is no provider.

**Verified** — `npm run db:verify` grew from 93 to **111 assertions**. The order
ones are behavioural: a real order is placed, then the catalog is re-priced to
999999 and the order is asserted to still cost what it cost. The four review
assertions run under `set role authenticated` with a real JWT claim, so the gate
is tested through RLS rather than around it. The harness also caught three
missing foreign-key indexes before they shipped.

**Not delivered: the screens.** Checkout, the success page, the admin list and
detail, and the review form do not exist — tracked as **D-31**, with **D-30** for
the basket provider that is written but not yet wired. The admin module registry
entry is deliberately held back so the sidebar cannot link to a 404 (§ 5); the
comment where it will go records everything it will contain. The migration is
committed but **not pushed to the hosted project**.

Along the way: `types/admin.ts`'s hand-written `OrderStatus` union became
`Enums<"order_status">` and its declared exception in `scripts/check-enums.mjs`
was deleted — the mechanism working as intended, three phases after it was
written. `ProductBadge` took its place as an exception, because `order_status`
also has a `new` and the overlap rule cannot tell a coincidence from a
divergence.

### Changed — the copy now uses the words a computer shop actually uses

The previous pass fixed sentence _structure_ and left a vocabulary problem
underneath it. The strings were parallel-free, grammatical, and still did not
sound like a shop: `Komplektuvchilar foyda uchun emas, sifati uchun tanlanadi`
is a slogan nobody says out loud, assembled from words an ordinary Uzbek shopper
does not use.

A banned-vocabulary table is now part of the standard (CLAUDE.md § 11a) and the
substitutions are applied throughout:

| Removed                      | Replaced with                       |
| ---------------------------- | ----------------------------------- |
| `komplektuvchilar`           | `butlovchi qismlar`                 |
| `tizim`, meaning a computer  | `kompyuter`                         |
| `xarakteristikalar`          | `texnik xususiyatlar`               |
| `konfiguratsiya` as a label  | `variant`                           |
| `Ruxsati` for screen density | `Aniqligi` — `ruxsat` is permission |
| `GGts`, `Gts`                | `GHz`, `Hz`                         |
| `Bondo'dan`                  | `Bondodan`                          |

**Headings state what they list.** `Shu oyda ko'p olinmoqda` →
`Ko'p sotilayotgan mahsulotlar`, `Chegirmalar` → `Chegirmadagi mahsulotlar`,
`Rasmiy hamkor brendlar` → `Mashhur brendlar`. The hero dropped its slogan for
the name of what is sold plus the one fact that decides a purchase: every
computer is checked and stress-tested before it ships. Russian and English were
rewritten independently, not adjusted to match.

**The admin panel was held to the same standard.** Twelve strings named our own
infrastructure to an operator with no reason to know it — `Supabase Storage`,
`service role`, `NEXT_LOCALE cookie`, `фикстуры`, `схема`, `bucket` — and now
say what the operator can and cannot do instead. Three clever asides were cut.

**Catalog copy followed**: twelve product descriptions, four category
descriptions and three reviews. The reviewers were renamed — `Marcus Reid` and
`Priya Nandakumar` on an Uzbek storefront read as an untranslated template
regardless of what the review says.

`npm run check` passes: 16 namespaces × 3 locales, 893 keys each; copy, enum and
translation gates all green.

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
