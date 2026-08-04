import { routes } from "@/lib/routes";
import { can, type Permission } from "@/lib/admin/permissions";

/**
 * The admin navigation tree.
 *
 * One declaration drives the sidebar, the mobile drawer, the breadcrumb trail
 * and the command palette. Three components rendering three hand-maintained
 * copies of the same list is how a module ends up reachable from search but
 * missing from the sidebar for one role.
 *
 * `labelKey` is a key into the `admin` namespace, never a label — § 11.
 * `icon` is a lucide icon *name*, resolved by the component that renders it, so
 * this module stays free of React and can be imported by anything.
 */
export type AdminNavItem = {
  /** Stable id — used for breadcrumbs, palette keys and active matching. */
  id: string;
  labelKey: string;
  href: string;
  icon: string;
  /**
   * Any-of. An item appears when the admin holds at least one of these, which
   * is the right test for "is this screen worth showing at all" — the controls
   * inside it check their own permissions individually.
   */
  permissions: readonly Permission[];
};

export type AdminNavSection = {
  id: string;
  labelKey: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    id: "overview",
    labelKey: "nav.sections.overview",
    items: [
      {
        id: "dashboard",
        labelKey: "nav.dashboard",
        href: routes.admin.index,
        icon: "LayoutDashboard",
        // Every admin has at least one read permission, so the dashboard is
        // visible to all of them; its individual widgets gate themselves.
        permissions: [
          "products.read",
          "inventory.read",
          "users.read",
          "settings.read",
          "banners.read",
        ],
      },
    ],
  },
  {
    id: "catalog",
    labelKey: "nav.sections.catalog",
    items: [
      {
        id: "products",
        labelKey: "nav.products",
        href: routes.admin.products,
        icon: "Package",
        permissions: ["products.read"],
      },
      {
        id: "categories",
        labelKey: "nav.categories",
        href: routes.admin.categories,
        icon: "FolderTree",
        permissions: ["categories.read", "categories.manage"],
      },
      {
        id: "brands",
        labelKey: "nav.brands",
        href: routes.admin.brands,
        icon: "Tag",
        permissions: ["brands.read", "brands.manage"],
      },
      {
        id: "inventory",
        labelKey: "nav.inventory",
        href: routes.admin.inventory,
        icon: "Boxes",
        permissions: ["inventory.read", "inventory.adjust"],
      },
    ],
  },
  {
    id: "storefront",
    labelKey: "nav.sections.storefront",
    items: [
      {
        id: "homepage",
        labelKey: "nav.homepage",
        href: routes.admin.homepage,
        icon: "LayoutTemplate",
        permissions: ["banners.read", "banners.manage"],
      },
      {
        id: "content",
        labelKey: "nav.content",
        href: routes.admin.content,
        icon: "FileText",
        permissions: ["banners.read", "banners.manage"],
      },
    ],
  },
  {
    id: "administration",
    labelKey: "nav.sections.administration",
    items: [
      {
        id: "users",
        labelKey: "nav.users",
        href: routes.admin.users,
        icon: "Users",
        permissions: ["users.read", "admins.manage", "roles.manage"],
      },
      {
        id: "audit",
        labelKey: "nav.audit",
        href: routes.admin.audit,
        icon: "ScrollText",
        permissions: ["audit.read"],
      },
      {
        id: "settings",
        labelKey: "nav.settings",
        href: routes.admin.settings,
        icon: "Settings",
        permissions: ["settings.read", "settings.update"],
      },
    ],
  },
];

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
  return ADMIN_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(granted, item.permissions)),
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
