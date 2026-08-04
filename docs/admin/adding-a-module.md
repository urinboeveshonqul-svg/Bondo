# Adding a module

The target is **under an hour** for a module that reuses the kit — coupons,
suppliers, gift cards, support tickets. Nothing on this list is architecture
work; it is filling in a record and writing the parts that are genuinely
specific to the thing being managed.

Work in this order. It is the database-first order from CLAUDE.md § 12, and
skipping to step 4 is how **K-15** and **K-16** happened.

---

## 1. The schema first

A module manages rows. If the table does not exist, or cannot store what the
screen collects, **the migration comes first**.

```bash
# after writing supabase/migrations/<timestamp>_<name>.sql
npm run db:types      # regenerate types/database.ts, and commit it
npm run db:verify     # the assertions must still pass
```

Checklist for the migration:

- [ ] RLS enabled **in the same migration that creates the table** — a table
      never exists without policies, not even briefly
- [ ] A policy per role that needs it, gated through `has_permission()`
- [ ] Every foreign key has a delete rule
- [ ] Localized content goes in a `<entity>_translations` table keyed
      `(<entity>_id, locale)`, cascading, with its own `search_vector` — never a
      `jsonb` blob (ADR-51)
- [ ] Enums, not free text, for anything the UI renders as a `<select>`

## 2. The permissions

The module's capabilities map to **existing** database permissions. Do not
invent one: the twenty permissions and five roles are the schema's and a trigger
protects them (ADR-44).

If the module genuinely needs a permission that does not exist, that is a
migration in step 1 — `insert into permissions`, plus the `role_permissions`
rows — and it lands before any UI reads it.

## 3. The registry entry

Add one entry to `lib/admin/modules.ts`:

```ts
{
  id: "coupons",
  labelKey: "nav.coupons",           // key into the `admin` namespace
  href: routes.admin.coupons,        // add it to lib/routes.ts first
  icon: "Ticket",                    // a lucide icon *name*
  navSection: "catalog",
  grants: {
    view: "coupons.read",
    create: "coupons.manage",
    update: "coupons.manage",
    publish: "coupons.manage",
    delete: "coupons.manage",
    settings: null,                  // null = this module does not offer it
    export: "coupons.read",
  },
  form: ["general", "advanced", "publish"],
  localized: true,
  seo: false,
  audit: true,
}
```

Add the id to `AdminModuleId` in `lib/admin/module.ts`.

**That is the whole of the chrome.** The sidebar, the mobile drawer, the
breadcrumb root, the command palette and the route guard now know about the
module. Do not edit `lib/admin/navigation.ts` — it is derived.

## 4. The service

`services/coupons.service.ts`, following `services/README.md`:

- takes a Supabase client as an argument, never constructs one (ADR-49)
- explicit column lists, never `select("*")`
- filtering, sorting and pagination **in the query**
- errors mapped through `lib/supabase-error.ts`
- translations folded through `lib/i18n/translations.ts`, so callers pass and
  receive `LocalizedText` and never see a `*_translations` row
- refuses to publish a record whose languages are incomplete (ADR-53)

## 5. The route

`app/[locale]/admin/coupons/page.tsx`, identical in shape to every other module:

```tsx
export default async function AdminCouponsPage({ params }: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  const capabilities = await guardModule("coupons", permissions);

  const t = await getTranslations("adminCoupons");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
        actions={capabilities.create ? <Button …/> : null}
      />

      <ModuleReadOnlyNotice id="coupons" permissions={permissions} />

      <CouponsTable coupons={coupons} capabilities={capabilities} />
    </>
  );
}
```

Use `guardModule(id, permissions, "create")` on a create route: reaching the
list is not the same as being allowed to add to it.

## 6. The screens

`components/admin/modules/coupons/`:

| File                 | Built from                                      |
| -------------------- | ----------------------------------------------- |
| `coupons-table.tsx`  | `ModuleTable` — columns only, never a new table |
| `coupon-form.tsx`    | `ModuleForm` — canonical sections only          |
| `coupon-dialogs.tsx` | `ModuleDeleteDialog`, `ModuleDetailsDrawer`     |

Every one of them takes `capabilities: ModuleCapabilities` as its permission
prop. One shape, resolved server-side, so a screen cannot invent its own rule.

## 7. The strings

`messages/{uz,ru,en}/adminCoupons.json` — **all three, or the build fails.**

- one namespace per feature area
- ICU plurals for anything with a count; Russian needs `few` and `many`
- nothing user-facing hardcoded in a component
- never machine-translated (CLAUDE.md § 11)

```bash
npm run i18n:check
```

## 8. Verify and record

```bash
npm run verify
```

Then, per CLAUDE.md § 6 and § 10:

- [ ] `PROJECT_STATUS.md` — status, next task, any new debt or known issue
- [ ] `CHANGELOG.md` — under `[Unreleased]`
- [ ] An ADR for anything with lasting consequences

---

## The checklist, condensed

- [ ] Migration + RLS + `npm run db:types` + `npm run db:verify`
- [ ] Registry entry in `lib/admin/modules.ts`; id added to `AdminModuleId`
- [ ] Route in `lib/routes.ts`
- [ ] Service in `services/`
- [ ] Page with `guardModule` + `ModuleHeader` + `ModuleReadOnlyNotice`
- [ ] Screens in `components/admin/modules/<id>/`, built from the kit
- [ ] Three message files
- [ ] `npm run verify`
- [ ] Documents updated

## What you should never write

| Never                                 | Use                                          |
| ------------------------------------- | -------------------------------------------- |
| A `<table>`                           | `ModuleTable`                                |
| A page `<h1>`                         | `ModuleHeader`                               |
| A form layout                         | `ModuleForm` + canonical sections            |
| A file input                          | `ModuleMediaManager` / `ModuleImageUploader` |
| SEO fields                            | `ModuleSeoPanel`                             |
| A language switcher for a field       | `LocalizedField` / `ModuleLanguageTabs`      |
| A `confirm()` or a bespoke dialog     | `ModuleDeleteDialog`                         |
| A `can(permissions, "…")` in a screen | the `capabilities` prop                      |
| A colour for a status                 | `ModuleStatusBadge` tone                     |
