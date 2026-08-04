import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import {
  AdminNotifications,
  type AdminNotificationItem,
} from "@/components/admin/layout/admin-notifications";
import {
  AdminSearch,
  type AdminSearchEntry,
} from "@/components/admin/layout/admin-search";
import { AdminShell } from "@/components/admin/layout/admin-shell";
import { AdminUserMenu } from "@/components/admin/layout/admin-user-menu";
import {
  QuickActions,
  type QuickAction,
} from "@/components/admin/layout/quick-actions";
import { can } from "@/lib/admin/permissions";
import { navItems, visibleNav } from "@/lib/admin/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import {
  adminCustomers,
  adminNotifications,
  adminOrders,
  adminProducts,
  adminRoles,
  contentPages,
  getAdminSession,
} from "@/mocks/admin";
import { brands, categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";
import { formatDate } from "@/utils/format";

/**
 * The admin panel is never indexed. It is not public, its content is not
 * useful to a crawler, and a stray link should not put it in a search result.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Admin layout.
 *
 * Two jobs, both server-side:
 *
 * 1. **Resolve who is signed in and what they may do.** Today that is a fixture
 *    (`getAdminSession()`); it becomes an awaited Supabase query with a role
 *    check, and this is the line it replaces. Permissions are resolved once here
 *    and everything below receives the *result* — no component recomputes them,
 *    and the permission model never reaches the browser.
 *
 * 2. **Filter the navigation before it is rendered.** A module an admin cannot
 *    use is absent, not disabled: a greyed-out "Settings" advertises exactly
 *    which capability to go looking for.
 *
 * > **K-1 is not closed by this file.** Middleware proves a session exists; it
 * > does not check roles. The real gate is a database read plus RLS, and it
 * > lands with the auth phase. Until then the panel is reachable in development
 * > only — see `isAdminPreview` in `supabase/session.ts` — and every screen
 * > carries a banner saying so.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = getAdminSession();
  const { permissions, user } = session;

  const sections = visibleNav(permissions);
  const items = navItems(permissions);

  const [t, tAdmin] = await Promise.all([
    getTranslations("admin.search.groups"),
    getTranslations("admin"),
  ]);
  const activeLocale = (await getLocale()) as Locale;

  // Quick actions mirror the permission model: an inventory manager gets
  // "Adjust stock" and nothing else, because that is all they can create.
  const quickActions: QuickAction[] = [
    can(permissions, "products.create") ? ("product" as const) : null,
    can(permissions, "categories.manage") ? ("category" as const) : null,
    can(permissions, "brands.manage") ? ("brand" as const) : null,
    can(permissions, "inventory.adjust") ? ("stock" as const) : null,
  ].filter((action): action is QuickAction => action !== null);

  /**
   * Search entries are built here so the palette receives a flat, localized,
   * already-permitted list. A client component filtering the catalog itself
   * would need the whole catalog in the browser and its own copy of the
   * permission rules.
   */
  const entries: AdminSearchEntry[] = [
    ...(can(permissions, "products.read")
      ? adminProducts.map((product) => ({
          id: `product-${product.id}`,
          group: "products",
          label: product.name[activeLocale],
          hint: product.sku,
          href: routes.admin.product(product.id),
          icon: "Package",
        }))
      : []),
    ...(can(permissions, ["categories.read", "categories.manage"])
      ? categories.map((category) => ({
          id: `category-${category.slug}`,
          group: "categories",
          label: category.name[activeLocale],
          href: routes.admin.categories,
          icon: "FolderTree",
        }))
      : []),
    ...(can(permissions, ["brands.read", "brands.manage"])
      ? brands.map((brand) => ({
          id: `brand-${brand.slug}`,
          group: "brands",
          label: brand.name,
          href: routes.admin.brands,
          icon: "Tag",
        }))
      : []),
    ...(can(permissions, "users.read")
      ? adminCustomers.map((customer) => ({
          id: `customer-${customer.id}`,
          group: "customers",
          label: customer.fullName,
          hint: customer.email,
          href: routes.admin.users,
          icon: "Users",
        }))
      : []),
    ...(can(permissions, "users.read")
      ? adminOrders.map((order) => ({
          id: `order-${order.id}`,
          group: "orders",
          label: order.reference,
          hint: order.customerName,
          href: routes.admin.index,
          icon: "ScrollText",
        }))
      : []),
    ...(can(permissions, ["banners.read", "banners.manage"])
      ? contentPages.map((page) => ({
          id: `page-${page.slug}`,
          group: "pages",
          label: page.title[activeLocale],
          href: routes.admin.contentPage(page.slug),
          icon: "FileText",
        }))
      : []),
    ...(can(permissions, ["settings.read", "settings.update"])
      ? [
          {
            id: "settings",
            group: "settings",
            label: tAdmin("nav.settings"),
            href: routes.admin.settings,
            icon: "Settings",
          },
        ]
      : []),
  ];

  const notifications: AdminNotificationItem[] = adminNotifications.map(
    (notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title[activeLocale],
      body: notification.body[activeLocale],
      href: notification.href,
      when: formatDate(notification.createdAt, activeLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      isRead: notification.isRead,
    }),
  );

  const roleLabel = user.roles
    .map(
      (key) =>
        adminRoles.find((role) => role.key === key)?.name[activeLocale] ?? key,
    )
    .join(", ");

  // `t` is read so the group headings are resolved eagerly and a missing key
  // fails here rather than inside the palette on first open.
  void t;

  return (
    <AdminShell
      sections={sections}
      topbar={
        <>
          <AdminSearch navItems={items} entries={entries} />
          <div className="ms-auto flex items-center gap-1">
            <QuickActions actions={quickActions} />
            <AdminNotifications items={notifications} />
            <AdminUserMenu
              name={user.fullName}
              email={user.email}
              initials={user.initials}
              roleLabel={roleLabel}
            />
          </div>
        </>
      }
    >
      {children}
    </AdminShell>
  );
}
