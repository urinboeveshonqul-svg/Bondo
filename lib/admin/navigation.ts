import {
  MODULE_NAV_SECTIONS,
  canOpenModule,
  moduleViewPermissions,
  type AdminModule,
  type ModuleNavSection,
} from "@/lib/admin/module";
import { ADMIN_MODULES } from "@/lib/admin/modules";
import type { Permission } from "@/lib/admin/permissions";

/**
 * The admin navigation tree.
 *
 * **Derived from `ADMIN_MODULES`, not maintained beside it.** This file used to
 * hold its own copy of every module's href, icon and permission list, which is
 * how a module ends up reachable from the command palette but missing from the
 * sidebar for one role — two lists, one of them edited. Now the registry is the
 * only place a module is described, and the sidebar, the drawer, the palette
 * and the breadcrumb root all read the same record.
 *
 * The exported shape is unchanged, so nothing that renders navigation had to
 * learn about modules.
 */
export type AdminNavItem = {
  /** Stable id — the module's id. Used for palette keys and active matching. */
  id: string;
  labelKey: string;
  href: string;
  icon: string;
  /**
   * Any-of. An item appears when the admin holds at least one of these, which
   * is the right test for "is this screen worth showing at all" — the controls
   * inside it check their own capabilities individually.
   */
  permissions: readonly Permission[];
};

export type AdminNavSection = {
  id: ModuleNavSection;
  labelKey: string;
  items: readonly AdminNavItem[];
};

function toNavItem(module: AdminModule): AdminNavItem {
  return {
    id: module.id,
    labelKey: module.labelKey,
    href: module.href,
    icon: module.icon,
    permissions: moduleViewPermissions(module),
  };
}

export const ADMIN_NAV: readonly AdminNavSection[] = MODULE_NAV_SECTIONS.map(
  (section) => ({
    id: section,
    labelKey: `nav.sections.${section}`,
    items: ADMIN_MODULES.filter((module) => module.navSection === section).map(
      toNavItem,
    ),
  }),
).filter((section) => section.items.length > 0);

/**
 * Filters the tree to what an admin may see, dropping sections left empty.
 *
 * Navigation is **removed**, not disabled. A greyed-out "Settings" tells someone
 * exactly which capability to go phishing for, and a disabled control that never
 * becomes enabled is noise in every screen reader pass.
 */
export function visibleNav(
  granted: ReadonlySet<Permission>,
): AdminNavSection[] {
  return MODULE_NAV_SECTIONS.map((section) => ({
    id: section,
    labelKey: `nav.sections.${section}`,
    items: ADMIN_MODULES.filter(
      (module) =>
        module.navSection === section && canOpenModule(granted, module),
    ).map(toNavItem),
  })).filter((section) => section.items.length > 0);
}

/** Flattens the tree — used by the command palette and breadcrumbs. */
export function navItems(granted: ReadonlySet<Permission>): AdminNavItem[] {
  return visibleNav(granted).flatMap((section) => section.items);
}

/**
 * The nav item matching a pathname, preferring the longest match so
 * `/admin/products/new` resolves to Products rather than to Dashboard.
 * The pathname must already have its locale prefix removed.
 */
export function activeNavItem(
  pathname: string,
  granted: ReadonlySet<Permission>,
): AdminNavItem | undefined {
  return navItems(granted)
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
