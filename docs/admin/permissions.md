# How permissions work

Two vocabularies, deliberately separate.

**The database has permissions.** Twenty of them, created by
`20260801000200_identity_and_rbac.sql`, held by roles rather than by users
(ADR-21), with five system roles a trigger protects from rename. They are named
after the schema — `products.update`, `inventory.adjust`, `roles.manage` — and
RLS policies enforce them through `has_permission()`.

**The interface has capabilities.** Seven of them, the same for every module:

```
view · create · update · delete · publish · settings · export
```

A capability is a question a screen asks. A permission is the database's answer.
The module's `grants` table connects the two:

```ts
grants: {
  view: "inventory.read",
  create: null,                 // stock is never created, only moved
  update: "inventory.adjust",
  publish: null,
  delete: null,                 // and never deleted — ADR-24
  settings: null,
  export: "inventory.read",
}
```

## Why the indirection

Every module gains uniform behaviour without the database gaining invented
permissions. That constraint is **ADR-44**: an interface that offers a capability
the database has no name for is an interface offering an action the insert will
reject — in production, to an operator who was shown the button.

`null` is the honest half. It does not mean "everyone may"; it means **this
module does not offer that, to anybody, super admin included**. `audit.create`
is `null` because the audit log is append-only and enforced by a trigger that
even `service_role` cannot talk its way past (ADR-27). Rendering that as an
absent control is correct, and it is more accurate than any permission would be.

## How it resolves

```
roles → permissions            permissionsFor()   lib/admin/permissions.ts
permissions → capabilities     capabilitiesOf()   lib/admin/module.ts
capabilities → controls        the `capabilities` prop
```

Resolved **once**, in the route, server-side:

```tsx
const { permissions } = getAdminSession();
const capabilities = await guardModule("products", permissions);
```

Everything below receives the answers. The permission set never reaches the
browser, and no component recomputes it — one place decides what someone can do.

## Three gates, and only one of them is real

| Gate                         | What it does                       | What it is worth              |
| ---------------------------- | ---------------------------------- | ----------------------------- |
| Navigation filtering         | Omits modules an admin cannot open | Usability. Not access control |
| `guardModule()` on the route | 404s a typed URL                   | Defence in depth              |
| **RLS**                      | Refuses the query                  | **The boundary** (ADR-4)      |

Navigation is _removed_, not disabled: a greyed-out "Settings" tells someone
exactly which capability to go phishing for, and a control that never becomes
enabled is noise in every screen reader pass.

The guard answers `notFound()` rather than 403, because a 403 confirms the route
exists.

> ⚠️ **K-1 is open.** There is no authentication in front of the panel at all.
> `getAdminSession()` is a fixture; the panel is reachable in development only,
> behind a `NODE_ENV` check Next.js inlines at build time (ADR-45). None of what
> is described here is a security boundary until the role check backed by RLS
> lands. It is how the interface stays consistent, not how the data stays safe.

## Which permission a capability should map to

Follow the schema, not intuition:

- If the database has a distinct permission, use it — `roles.manage` is
  `settings` on the team module, because holding it is what separates editing a
  colleague's job title from making them a super admin.
- If it does not, map to the closest one that genuinely gates the action.
  `publish` on products is `products.update`, because status is a column like any
  other. Naming it separately still buys something: the day a `products.publish`
  permission exists, that is the one line that changes.
- If nothing gates it because nothing may do it, write `null`.

Never add a key to `PERMISSIONS` without the matching migration. The list is a
transcription of the database, and divergence is the failure this whole
structure exists to prevent.
