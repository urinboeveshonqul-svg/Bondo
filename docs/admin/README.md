# Admin architecture

The admin panel is built from **one module architecture**, not from thirteen
screens that happen to look alike. Every module — products, categories, brands,
inventory, homepage, pages, team, audit, settings — is described by a record in
`lib/admin/modules.ts`, and everything else is derived from that record.

| Document                                 | Answers                                             |
| ---------------------------------------- | --------------------------------------------------- |
| [architecture.md](architecture.md)       | Why one architecture, and what is derived from what |
| [adding-a-module.md](adding-a-module.md) | The checklist for a new module, start to finish     |
| [components.md](components.md)           | Every reusable component and when to reach for it   |
| [permissions.md](permissions.md)         | Capabilities, grants, and where the real gate is    |
| [localization.md](localization.md)       | How a translatable field works, end to end          |

---

## The shape of a module

Every module offers the same workflow, in the same order, with the same
controls:

```
dashboard → list → search → filters → sorting → bulk actions
         → create → edit → delete → details → audit history
         → localization → permissions
```

An operator who has learned products knows brands. That is the whole point: the
panel gains a module roughly every phase, and the cost of thirteen slightly
different screens is not that they look inconsistent, it is that they _behave_
differently in ways nobody notices until an operator relies on one.

## The three files that define a module

```
lib/admin/modules.ts                      the record: routes, icon, grants, form sections
components/admin/modules/<id>/            the screens: table, form, dialogs
messages/{uz,ru,en}/admin<Area>.json      the strings, in all three languages
```

Nothing in the panel's chrome is touched when a module is added. The sidebar,
the mobile drawer, the breadcrumb root, the command palette and the route guard
all read the registry.

## What is _not_ in this folder

The database is documented in [docs/database/](../database/). The admin renders
that schema; where the two disagree, the schema is right (CLAUDE.md § 12).
