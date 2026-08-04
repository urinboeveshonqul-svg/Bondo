/**
 * The authorisation model the admin interface renders against.
 *
 * **This mirrors the database, it does not define it.** Phase 2 shipped
 * `roles` / `permissions` / `role_permissions` / `user_roles` with 20
 * permissions and 5 system roles protected from rename by a trigger. The keys
 * and grants below are transcribed from
 * `supabase/migrations/20260801000200_identity_and_rbac.sql`. When the admin is
 * wired to Supabase these become a query, and the union type here becomes the
 * compile-time check that the query returned something the UI understands.
 *
 * Divergence from the migration is the failure mode to watch: a permission
 * granted here but not there produces an interface offering an action the
 * database will refuse. `PERMISSIONS` is exported so a future test can assert
 * the two sets match once `types/database.ts` exists (**K-3**).
 *
 * Pure data and pure functions — no React, no Supabase, no env. `lib/` may be
 * imported from anywhere.
 */

export const PERMISSIONS = [
  "products.read",
  "products.create",
  "products.update",
  "products.delete",
  "categories.read",
  "categories.manage",
  "brands.read",
  "brands.manage",
  "inventory.read",
  "inventory.adjust",
  "banners.read",
  "banners.manage",
  "settings.read",
  "settings.update",
  "users.read",
  "users.update",
  "users.assign_roles",
  "admins.manage",
  "roles.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = [
  "super_admin",
  "catalog_manager",
  "inventory_manager",
  "support_agent",
  "content_editor",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/**
 * Grants per role, transcribed from the migration.
 *
 * `super_admin` is spread from `PERMISSIONS` rather than listed, matching the
 * migration's set-based insert: adding a permission must extend the super
 * admin automatically, or the next person to add one silently creates a
 * capability nobody can use.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  catalog_manager: [
    "products.read",
    "products.create",
    "products.update",
    "products.delete",
    "categories.read",
    "categories.manage",
    "brands.read",
    "brands.manage",
    "inventory.read",
  ],
  inventory_manager: ["products.read", "inventory.read", "inventory.adjust"],
  support_agent: [
    "products.read",
    "categories.read",
    "brands.read",
    "inventory.read",
    "users.read",
  ],
  content_editor: [
    "banners.read",
    "banners.manage",
    "settings.read",
    "settings.update",
  ],
};

/** The effective permission set for a set of roles, unioned. */
export function permissionsFor(roles: readonly RoleKey[]): Set<Permission> {
  const granted = new Set<Permission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) granted.add(permission);
  }

  return granted;
}

/**
 * Whether a permission set satisfies a requirement.
 *
 * `required` is an **any-of** list, not all-of: a screen that needs
 * `products.create` *or* `products.update` to be worth showing is the common
 * case, and an all-of check would hide the products screen from someone who can
 * edit but not delete. Screens that genuinely need several permissions check
 * them individually at the control, which is where the distinction matters.
 */
export function can(
  granted: ReadonlySet<Permission>,
  required: Permission | readonly Permission[],
): boolean {
  const list = Array.isArray(required) ? required : [required as Permission];

  return list.some((permission) => granted.has(permission));
}
