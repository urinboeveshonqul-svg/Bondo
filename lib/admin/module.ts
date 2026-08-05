/**
 * The admin module contract.
 *
 * Every screen in the panel — products, categories, brands, inventory, the
 * homepage, pages, the team, the audit log, settings — is a **module**, and a
 * module is described by data rather than by the code that renders it. One
 * declaration drives the sidebar, the breadcrumb trail, the command palette, the
 * route guard, the toolbar, the form's tab strip and the permission checks on
 * every control inside it.
 *
 * The reason is not tidiness. The panel gains a module roughly every phase, and
 * the failure mode of hand-written screens is not that they look different — it
 * is that they *behave* differently in ways nobody notices: one list forgets to
 * gate its delete button, another shows a module in the sidebar that 404s when
 * opened, a third publishes a record with two languages filled in. Deriving all
 * of it from one record makes those states unrepresentable rather than merely
 * discouraged.
 *
 * Pure data and pure functions — no React, no Supabase, no env, so the registry
 * is importable from a Server Component, a Server Action, a script or a test
 * (§ 4 layer rules).
 */

import { can, type Permission } from "@/lib/admin/permissions";

// -----------------------------------------------------------------------------
// Capabilities
// -----------------------------------------------------------------------------

/**
 * What an administrator can do *within* a module.
 *
 * This is the vocabulary the interface speaks. It is deliberately **not** a new
 * permission model: `Permission` is the database's, transcribed from
 * `20260801000200_identity_and_rbac.sql` and protected by a trigger (ADR-44).
 * A capability is a question the interface asks ("may this person delete
 * here?"); the module's `grants` table answers it by naming the database
 * permission that satisfies it.
 *
 * The indirection buys two things. A module gains uniform behaviour without the
 * database gaining invented permissions, and a capability the database has no
 * answer for is written as `null` — an honest gap that renders as an absent
 * control, rather than a button the insert would refuse.
 */
export const MODULE_CAPABILITIES = [
  "view",
  "create",
  "update",
  "delete",
  "publish",
  "settings",
  "export",
] as const;

export type ModuleCapability = (typeof MODULE_CAPABILITIES)[number];

/**
 * Capability → the database permission that grants it, or `null` when the
 * database has none.
 *
 * `null` is not "everyone may": it is "this module does not offer that". The
 * audit log has no `create`, because nothing may write an audit row by hand —
 * the table is append-only and trigger-enforced (ADR-27).
 */
export type CapabilityGrants = Readonly<
  Record<ModuleCapability, Permission | null>
>;

/** Nothing granted. The starting point for a read-only module's table. */
export const NO_CAPABILITIES: CapabilityGrants = {
  view: null,
  create: null,
  update: null,
  delete: null,
  publish: null,
  settings: null,
  export: null,
};

// -----------------------------------------------------------------------------
// Form sections
// -----------------------------------------------------------------------------

/**
 * The canonical order of sections in every create/edit form.
 *
 * A module picks a subset; it never reorders and never invents. An operator who
 * has learned that publishing controls sit at the end of the product form finds
 * them at the end of the page form too, and the muscle memory transfers. This
 * ordering is also the order of increasing consequence: what the thing is, what
 * it looks like, what it costs, and only then whether the world can see it.
 */
export const MODULE_FORM_SECTIONS = [
  "general",
  "media",
  "pricing",
  "inventory",
  "seo",
  "localization",
  "advanced",
  "publish",
] as const;

export type ModuleFormSection = (typeof MODULE_FORM_SECTIONS)[number];

/** Sorts a module's declared sections into the canonical order. */
export function orderFormSections(
  sections: readonly ModuleFormSection[],
): ModuleFormSection[] {
  return MODULE_FORM_SECTIONS.filter((section) => sections.includes(section));
}

// -----------------------------------------------------------------------------
// Navigation grouping
// -----------------------------------------------------------------------------

/**
 * Sidebar groups, in the order they appear.
 *
 * `sales` sits directly under `overview` because it is the group somebody opens
 * every morning — an order that nobody rang about is the one thing in this panel
 * with a customer waiting at the other end of it.
 */
export const MODULE_NAV_SECTIONS = [
  "overview",
  "sales",
  "catalog",
  "storefront",
  "administration",
] as const;

export type ModuleNavSection = (typeof MODULE_NAV_SECTIONS)[number];

// -----------------------------------------------------------------------------
// The module record
// -----------------------------------------------------------------------------

export type AdminModuleId =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "brands"
  | "inventory"
  | "homepage"
  | "content"
  | "users"
  | "audit"
  | "settings";

export type AdminModule = {
  id: AdminModuleId;
  /** Key into the `admin` namespace, never a label — § 11. */
  labelKey: string;
  /** Unprefixed path from `lib/routes.ts`; `<Link>` adds the locale. */
  href: string;
  /** A lucide icon *name*, resolved by whichever component renders it. */
  icon: string;
  navSection: ModuleNavSection;
  grants: CapabilityGrants;
  /**
   * Extra permissions that make the module worth showing even though they grant
   * no capability in it. Only the dashboard uses this: it is a read-only view
   * over every other module, so any read permission earns a place in the nav.
   */
  viewAlso?: readonly Permission[];
  /** Sections the module's editor renders, in any order — sorted on use. */
  form: readonly ModuleFormSection[];
  /** Whether records carry `*_translations` rows and need the language tabs. */
  localized: boolean;
  /** Whether the SEO panel applies, and whether its slug field is localized. */
  seo: false | { localizedSlug: boolean };
  /** Whether the record has an audit trail worth showing on its detail view. */
  audit: boolean;
};

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Every permission that should make this module visible.
 *
 * Any-of, not all-of: a role that may edit products but not delete them still
 * needs the products screen. The list is **derived** from the grants rather than
 * maintained beside them, which is what stops a new capability from being added
 * without the navigation learning about it.
 */
export function moduleViewPermissions(module: AdminModule): Permission[] {
  const fromGrants = MODULE_CAPABILITIES.map(
    (capability) => module.grants[capability],
  ).filter((permission): permission is Permission => permission !== null);

  return [...new Set([...fromGrants, ...(module.viewAlso ?? [])])];
}

/** Whether this administrator may see the module at all. */
export function canOpenModule(
  granted: ReadonlySet<Permission>,
  module: AdminModule,
): boolean {
  return can(granted, moduleViewPermissions(module));
}

/**
 * Whether a specific capability is available.
 *
 * A capability the module does not offer (`null`) is never granted, including
 * to a super admin — "delete an audit row" is not a permission anybody holds,
 * it is a thing the database refuses.
 */
export function canModule(
  granted: ReadonlySet<Permission>,
  module: AdminModule,
  capability: ModuleCapability,
): boolean {
  const permission = module.grants[capability];

  return permission !== null && granted.has(permission);
}

/** The resolved capability set, for passing into a Client Component. */
export type ModuleCapabilities = Readonly<Record<ModuleCapability, boolean>>;

/**
 * Resolves every capability once, server-side.
 *
 * Client components receive the *answers*, never the permission set and never
 * the module record: the authorisation model does not need to reach the browser
 * for a delete button to know whether to render.
 */
export function capabilitiesOf(
  granted: ReadonlySet<Permission>,
  module: AdminModule,
): ModuleCapabilities {
  return Object.fromEntries(
    MODULE_CAPABILITIES.map((capability) => [
      capability,
      canModule(granted, module, capability),
    ]),
  ) as ModuleCapabilities;
}

/** Every capability denied — what a guard hands to a read-only render. */
export const NO_MODULE_CAPABILITIES: ModuleCapabilities = Object.fromEntries(
  MODULE_CAPABILITIES.map((capability) => [capability, false]),
) as ModuleCapabilities;
