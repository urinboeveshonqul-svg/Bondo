# The reusable components

Everything here lives in `components/admin/module/` unless stated otherwise.
A module composes them; it does not fork them. If one of them does not fit a
module's need, the component gains a prop — a second implementation is how the
panel ends up with two ways to delete something.

---

## Chrome — `components/admin/layout/`

| Component            | File                      | Notes                                                      |
| -------------------- | ------------------------- | ---------------------------------------------------------- |
| `AdminShell`         | `admin-shell.tsx`         | Sidebar + topbar + content column. Three layouts, one tree |
| `AdminSidebar`       | `admin-sidebar.tsx`       | Rendered from the filtered nav; collapses to icons         |
| `AdminBreadcrumbs`   | `admin-breadcrumbs.tsx`   | Composed by `ModuleHeader`; crumbs are passed, not derived |
| `AdminSearch`        | `admin-search.tsx`        | Command palette, `Ctrl`/`Cmd` + K                          |
| `AdminNotifications` | `admin-notifications.tsx` | Topbar bell                                                |
| `AdminUserMenu`      | `admin-user-menu.tsx`     | Topbar account menu                                        |
| `QuickActions`       | `quick-actions.tsx`       | Topbar create menu, permission-filtered                    |

The topbar is assembled in `app/[locale]/admin/layout.tsx` and passed to
`AdminShell` as a slot, so everything in it is built server-side.

## Page structure

| Component                | Use                                                            |
| ------------------------ | -------------------------------------------------------------- |
| `ModuleHeader`           | Breadcrumb + `h1` + description + actions. Every module page   |
| `ModulePermissionGuard`  | `guardModule()` and `ModuleReadOnlyNotice` — see below         |
| `ModuleCard`             | When a row is not the right shape — a page, a role, a banner   |
| `ModuleTabs`             | Splitting one screen into views. Not the language switcher     |
| `StatisticsCards`        | The grid; `StatCard` is one figure                             |
| `LineChart` / `BarChart` | `charts.tsx`. Server-rendered SVG with a visually hidden table |

## Lists

| Component                | Use                                                            |
| ------------------------ | -------------------------------------------------------------- |
| `ModuleTable`            | Every list. Generic over the row; describe columns, not markup |
| `ModuleToolbar`          | The control row — for screens that are not tables              |
| `ModuleSearch`           | The search box                                                 |
| `ModuleFilters`          | One `<select>` per filter                                      |
| `ModuleColumnVisibility` | Show/hide columns; the last visible one cannot be hidden       |
| `ModuleBulkActions`      | The selection bar, above the list rather than floating over it |
| `ModulePagination`       | Page controls + the "showing x–y of z" live region             |
| `ModuleEmptyState`       | Nothing to list                                                |
| `ModuleLoadingState`     | `table` / `cards` / `form` skeletons                           |
| `ModuleStatusBadge`      | Six tones by meaning; a dot **and** a word, never colour alone |

`ModuleTable` composes the six above it. A screen that is not a table — the
category tree, the homepage composer, the page grid — uses them directly.

## Editing

| Component                                                                   | Use                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ModuleForm`                                                                | The layout. Sections keyed by the canonical union      |
| `ModuleFormSection` / `ModuleFormRow`                                       | A titled block; two fields side by side                |
| `LocalizedField` / `LocalizedTextField` / `LocalizedTextarea`               | One field, three languages                             |
| `ModuleLanguageTabs`                                                        | The tab strip alone, for a custom control              |
| `TranslationStatus` / `TranslationProgress` / `MissingTranslationIndicator` | Coverage read-outs                                     |
| `ModuleSeoPanel`                                                            | Slug, meta, keywords, canonical, Open Graph, card type |
| `ModuleMediaManager` / `ModuleImageUploader`                                | The only upload control in the panel                   |
| `KeywordInput`                                                              | Free-form tags, deliberately not localized             |
| `ModuleSortableList`                                                        | Drag **and** keyboard reordering (WCAG 2.2 SC 2.5.7)   |

### The canonical form sections

```
general → media → pricing → inventory → seo → localization → advanced → publish
```

A module declares a subset in the registry and fills them in here. It cannot
reorder them or invent one: `sections` is keyed by the union, and `ModuleForm`
renders in the order defined in `lib/admin/module.ts`. Section titles default to
`admin.form.sections.*`, so "General" is translated once rather than as
"Basics", "Details" and "Overview" in three modules.

Ordering is by increasing consequence — what the thing is, what it looks like,
what it costs, and only then whether the world can see it.

## Dialogs and detail

| Component             | Use                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `ModuleDeleteDialog`  | Every destructive action. Names the record; counts a bulk delete; can demand the name typed back |
| `ModuleDetailsDrawer` | Read-only detail without losing the operator's place in the list                                 |
| `ModuleDetailField`   | A `<dl>` pair inside the drawer                                                                  |
| `ModuleAuditHistory`  | Who changed this record and when, from `audit_logs`                                              |

`ModuleDetailsDrawer` is a drawer and not a route deliberately: "what is this
row" is not worth a navigation, and an edit is — an edit deserves a URL, which
is what makes it shareable and recoverable.

## Permissions

```tsx
const capabilities = await guardModule("products", permissions);
// → { view, create, update, delete, publish, settings, export }
```

Client components receive that object and nothing else. The permission set and
the module record stay on the server; a delete button does not need the
authorisation model in the browser to know whether to render.

`ModuleReadOnlyNotice` states read-only rather than leaving it implied by absent
buttons — someone told they can edit products who finds no Save assumes the
panel is broken.

See [permissions.md](permissions.md).
