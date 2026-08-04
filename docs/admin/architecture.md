# Why every module shares one architecture

## The problem it solves

The admin panel had thirteen screens before this refactor and will have thirty
before launch — orders, customers, reviews, coupons, suppliers, invoices,
support tickets. Written independently, each one is a chance to get something
subtly wrong:

- a list that forgets to gate its delete button on a permission
- a module visible in the sidebar that returns 404 when opened, because the
  navigation entry and the route check drifted apart
- a table whose sort is mouse-only, or whose selection count a screen reader
  never hears
- a form that publishes a record with two of three languages filled in
- a second upload control that quietly has no alt-text field

None of those show up in review. All of them show up for the person who depends
on them.

The architecture makes them **unrepresentable** rather than discouraged: there
is one table, one form layout, one media manager, one SEO panel, one permission
model, and a module cannot opt out of them without writing obviously novel code.

## What is derived from what

```
lib/admin/modules.ts          ← the only place a module is described
        │
        ├── lib/admin/navigation.ts     sidebar, drawer, palette, active match
        ├── module-permission-guard     route gate + read-only notice
        ├── module-form                 which sections, in the canonical order
        └── capabilitiesOf()            what each control may do, resolved once
```

`ADMIN_NAV` used to be a second hand-maintained list of hrefs, icons and
permissions. It is now generated from the registry, which is what stops a module
from being reachable in the command palette but missing from the sidebar for one
role.

**Verified rather than assumed:** the derived navigation was compared against the
previous hand-written lists for all five system roles, and the visible set is
identical. Products gains `products.create/update/delete` to its any-of list and
the team gains `users.update`, but no role holds those without already holding
the read permission that made the module visible before.

## The layers a module lives in

The project's layer rules (CLAUDE.md § 4) are binding, and they decide where a
module's code goes. This is the one place the brief's suggested folder shape and
the repository's architecture disagree, so it is written down rather than
silently resolved.

The brief proposes colocating everything under one module folder — `page.tsx`,
`components/`, `services/`, `actions/`, `schemas/`, `types/`. Two of those cannot
move:

- **`services/` may never import React** and must stay callable from a webhook, a
  cron job or a script. A service nested inside a route folder is a service
  somebody will eventually import a component into.
- **`actions/` are public HTTP endpoints.** They are validated centrally through
  `createAction()`; scattering them under `app/` makes "is every Server Action
  validated" a question nobody can answer by looking.

So the convention is the same for every module, and it spans layers rather than
collapsing them:

| Concern     | Location                               | Rule                                         |
| ----------- | -------------------------------------- | -------------------------------------------- |
| Route       | `app/[locale]/admin/<id>/page.tsx`     | Server Component; guards, then renders       |
| Screens     | `components/admin/modules/<id>/`       | table, form, dialogs, drawer for that module |
| Shared kit  | `components/admin/module/`             | the `Module*` components — never forked      |
| Chrome      | `components/admin/layout/`             | shell, sidebar, topbar, breadcrumb, search   |
| Registry    | `lib/admin/modules.ts`                 | one entry per module                         |
| Contract    | `lib/admin/module.ts`                  | capabilities, form sections, nav sections    |
| Data access | `services/<id>.service.ts`             | the only place Supabase is touched           |
| Mutations   | `actions/admin/<id>.actions.ts`        | `createAction()`, arriving with Phase 6      |
| View models | `types/admin.ts`                       | declarations only, no runtime code           |
| Strings     | `messages/{uz,ru,en}/admin<Area>.json` | all three, enforced by `npm run check`       |

Every module follows it. There is no module with a different shape.

## The route is always the same five lines

```tsx
const { locale } = await params;
setRequestLocale(locale);

const { permissions } = getAdminSession();
const capabilities = await guardModule("products", permissions);
```

`guardModule` answers 404 — not 403 — when the module is not permitted, because
a 403 confirms the route exists and tells someone probing which module to go
phishing for credentials against. It returns the resolved capability set, and
that object is what the screen renders against. The permission model itself
never reaches the browser.

## What this architecture does not claim

- **It is not the authorisation boundary.** RLS is (ADR-4). The guard runs
  against a permission set that is currently a fixture and will become a database
  read. **K-1** — no authentication in front of the panel at all — is still open.
- **It does not make the lists scale.** Search, filter, sort and pagination are
  still in memory (**D-2**). The component boundary is drawn so that moving them
  into the query changes `ModuleTable` and nothing above it.
- **It does not persist anything.** Every form still reports honestly that
  nothing was saved (**D-16**). The forms hold the domain types, so wiring a
  Server Action to `onSubmit` is the whole change.

## Design consistency

Consistency is a property of the components, not of a style guide nobody reads:

| Element             | Owned by                                          |
| ------------------- | ------------------------------------------------- |
| Page heading        | `ModuleHeader` — always one `h1`                  |
| Section frame       | `ModuleFormSection` — border, radius, padding     |
| Card                | `ModuleCard` — same frame as a section            |
| Table               | `ModuleTable`                                     |
| Empty state         | `ModuleEmptyState`                                |
| Loading state       | `ModuleLoadingState`                              |
| Destructive confirm | `ModuleDeleteDialog`                              |
| Status pill         | `ModuleStatusBadge` — six tones, never raw colour |

Colour follows ADR-37 throughout: orange means a price reduction and nothing
else, which is why a status badge cannot ask for a hue, only for a meaning.
