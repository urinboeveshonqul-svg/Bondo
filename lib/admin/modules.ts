/**
 * The admin module registry.
 *
 * **One declaration per module, and everything else is derived from it**: the
 * sidebar, the mobile drawer, the breadcrumb root, the command palette, the
 * route guard, the toolbar's action buttons, the form's tab strip, and every
 * permission check inside the screen.
 *
 * Adding a module is an entry here plus a folder under
 * `components/admin/modules/`. Nothing else in the panel's chrome is edited —
 * see `docs/admin/adding-a-module.md`, which is written as a checklist against
 * this file.
 *
 * ## Reading a `grants` table
 *
 * The keys are the interface's vocabulary; the values are the database's
 * permissions (`20260801000200_identity_and_rbac.sql`). `null` means the module
 * does not offer that capability **to anybody**, super admin included, because
 * no permission grants it — see `audit.create`, which is refused by a trigger
 * rather than by a policy (ADR-27).
 *
 * The registry never invents a permission. That constraint is ADR-44: the five
 * roles and twenty permissions are the schema's, protected from rename by a
 * trigger, and an interface that offers a capability the database has no name
 * for is an interface that offers an action the insert will reject.
 */

import type { AdminModule, AdminModuleId } from "@/lib/admin/module";
import { NO_CAPABILITIES } from "@/lib/admin/module";
import { routes } from "@/lib/routes";

export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    id: "dashboard",
    labelKey: "nav.dashboard",
    href: routes.admin.index,
    icon: "LayoutDashboard",
    navSection: "overview",
    // The dashboard grants nothing: it creates, updates and deletes nothing.
    // Its widgets gate themselves on the permission behind each figure.
    grants: NO_CAPABILITIES,
    // Every administrator holds at least one read permission, so every
    // administrator gets a dashboard — of whatever they are allowed to see.
    viewAlso: [
      "products.read",
      "inventory.read",
      "users.read",
      "settings.read",
      "banners.read",
    ],
    form: [],
    localized: false,
    seo: false,
    audit: false,
  },
  // -----------------------------------------------------------------------------
  // `orders` is deliberately absent, and this is the note that says why
  // -----------------------------------------------------------------------------
  // The schema, the services and the Server Actions all exist and are verified
  // (20260809001000_orders_and_reviews.sql, 111 assertions in `db:verify`). The
  // **screens** do not, and a module here is a sidebar entry — so adding the
  // record before the route would put a link to a 404 in front of every operator
  // holding `orders.read`, which § 5 forbids and which no amount of intent makes
  // less broken.
  //
  // Everything the entry will contain is settled and written down in
  // PROJECT_STATUS.md § Orders; adding it back is this comment's replacement plus
  // `app/[locale]/admin/orders/`. Tracked as **D-30**.
  {
    id: "products",
    labelKey: "nav.products",
    href: routes.admin.products,
    icon: "Package",
    navSection: "catalog",
    grants: {
      view: "products.read",
      create: "products.create",
      update: "products.update",
      // Publishing is `products.update` rather than a permission of its own:
      // the schema has no `products.publish`, and status is a column on the row
      // like any other. Naming it separately here still buys something — the
      // publish panel asks for `publish`, so the day a `products.publish`
      // permission exists this is the one line that changes.
      publish: "products.update",
      delete: "products.delete",
      settings: null,
      export: "products.read",
    },
    form: [
      "general",
      "media",
      "pricing",
      "inventory",
      "seo",
      "localization",
      "advanced",
      "publish",
    ],
    localized: true,
    seo: { localizedSlug: true },
    audit: true,
  },
  {
    id: "categories",
    labelKey: "nav.categories",
    href: routes.admin.categories,
    icon: "FolderTree",
    navSection: "catalog",
    grants: {
      view: "categories.read",
      create: "categories.manage",
      update: "categories.manage",
      publish: "categories.manage",
      delete: "categories.manage",
      settings: null,
      export: "categories.read",
    },
    form: ["general", "media", "seo", "localization", "advanced", "publish"],
    localized: true,
    seo: { localizedSlug: true },
    audit: true,
  },
  {
    id: "brands",
    labelKey: "nav.brands",
    href: routes.admin.brands,
    icon: "Tag",
    navSection: "catalog",
    grants: {
      view: "brands.read",
      create: "brands.manage",
      update: "brands.manage",
      publish: "brands.manage",
      delete: "brands.manage",
      settings: null,
      export: "brands.read",
    },
    // No localized slug: `brands.slug` stayed on the parent row through the
    // localization migration, because a manufacturer's name is a trademark and
    // is spelled the same in all three languages.
    form: ["general", "media", "seo", "localization", "publish"],
    localized: true,
    seo: { localizedSlug: false },
    audit: true,
  },
  {
    id: "inventory",
    labelKey: "nav.inventory",
    href: routes.admin.inventory,
    icon: "Boxes",
    navSection: "catalog",
    grants: {
      view: "inventory.read",
      // Stock is never created or deleted, only moved: `quantity_on_hand` may
      // change only through an `inventory_movements` insert, and a trigger
      // rejects every other write (ADR-24). The module therefore has one
      // mutating capability, and it is an adjustment.
      create: null,
      update: "inventory.adjust",
      publish: null,
      delete: null,
      settings: null,
      export: "inventory.read",
    },
    form: ["inventory"],
    localized: false,
    seo: false,
    audit: true,
  },
  {
    id: "homepage",
    labelKey: "nav.homepage",
    href: routes.admin.homepage,
    icon: "LayoutTemplate",
    navSection: "storefront",
    grants: {
      view: "banners.read",
      create: "banners.manage",
      update: "banners.manage",
      publish: "banners.manage",
      delete: "banners.manage",
      settings: null,
      export: null,
    },
    form: ["general", "media", "localization", "advanced", "publish"],
    localized: true,
    seo: false,
    audit: true,
  },
  {
    id: "content",
    labelKey: "nav.content",
    href: routes.admin.content,
    icon: "FileText",
    navSection: "storefront",
    grants: {
      view: "banners.read",
      create: "banners.manage",
      update: "banners.manage",
      publish: "banners.manage",
      delete: "banners.manage",
      settings: null,
      export: null,
    },
    form: ["general", "seo", "localization", "publish"],
    localized: true,
    seo: { localizedSlug: true },
    audit: true,
  },
  {
    id: "users",
    labelKey: "nav.users",
    href: routes.admin.users,
    icon: "Users",
    navSection: "administration",
    grants: {
      view: "users.read",
      create: "admins.manage",
      update: "users.update",
      publish: null,
      delete: "admins.manage",
      // Role assignment is the module's settings surface, and it is its own
      // permission in the schema — holding it is what separates an operator who
      // can edit a colleague's job title from one who can make them a super
      // admin.
      settings: "roles.manage",
      export: null,
    },
    form: ["general", "advanced"],
    localized: false,
    seo: false,
    audit: true,
  },
  {
    id: "audit",
    labelKey: "nav.audit",
    href: routes.admin.audit,
    icon: "ScrollText",
    navSection: "administration",
    grants: {
      view: "audit.read",
      // Append-only, enforced by a trigger that RLS cannot be talked out of —
      // not even `service_role` may rewrite this table (ADR-27). An audit log
      // anyone can edit is not evidence of anything.
      create: null,
      update: null,
      publish: null,
      delete: null,
      settings: null,
      export: "audit.read",
    },
    form: [],
    localized: false,
    seo: false,
    audit: false,
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    href: routes.admin.settings,
    icon: "Settings",
    navSection: "administration",
    grants: {
      view: "settings.read",
      create: null,
      update: "settings.update",
      publish: null,
      delete: null,
      settings: "settings.update",
      export: null,
    },
    form: ["general", "localization", "advanced"],
    localized: true,
    seo: false,
    audit: true,
  },
];

const BY_ID = new Map<AdminModuleId, AdminModule>(
  ADMIN_MODULES.map((module) => [module.id, module]),
);

/**
 * The module record for an id.
 *
 * Throws rather than returning `undefined`. Every caller is a page or a guard
 * that cannot do anything useful without one, and a missing module is a typo in
 * this repository, not a runtime condition — failing here names the id, where
 * failing later would render a screen with every control silently hidden.
 */
export function adminModule(id: AdminModuleId): AdminModule {
  const found = BY_ID.get(id);

  if (!found) throw new Error(`Unknown admin module: ${id}`);

  return found;
}
