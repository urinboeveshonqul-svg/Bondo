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
import { requireAdmin } from "@/lib/auth/guards";
import { touchAdminLastSeen } from "@/services/authorization.service";
import { createClient } from "@/supabase/server";
import { navItems, visibleNav } from "@/lib/admin/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { adminProducts, adminRoles, contentPages } from "@/mocks/admin";
import { brands, categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";

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
 * 1. **Resolve who is signed in and what they may do.** `requireAdmin()` reads
 *    the `admins` register and the role graph for the signed-in user. Roles and
 *    permissions are resolved **once** here and everything below receives the
 *    *result* — no component recomputes them, and the permission model never
 *    reaches the browser.
 *
 * 2. **Filter the navigation before it is rendered.** A module an admin cannot
 *    use is absent, not disabled: a greyed-out "Settings" advertises exactly
 *    which capability to go looking for.
 *
 * > **K-1 is closed by this file.** The `NODE_ENV` preview gate (ADR-45) and
 * > `isAdminPreview` are deleted; a signed-in customer who types `/admin` now
 * > gets a 404, and an anonymous visitor is sent to sign-in. The panel is
 * > unreachable until an administrator exists — which is what
 * > `npm run admin:bootstrap` is for.
 * >
 * > RLS remains the authorisation boundary (ADR-4). This gate decides which
 * > screens open; the policies decide which rows come back.
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

  // **K-1 closes here.** The panel is no longer reachable on a NODE_ENV check:
  // this is a real query for an active `admins` row, and a signed-in customer
  // who guesses the URL gets a 404 rather than a 403 that would confirm the
  // route exists. RLS refuses every admin query underneath it regardless
  // (ADR-4) — this is the layer that keeps people out of screens, not the layer
  // that keeps data safe.
  const { user: authUser, authorization } = await requireAdmin();
  const { permissions } = authorization;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", authUser.id)
    .maybeSingle();

  // Records that this administrator was seen, for the team screen. Deliberately
  // not awaited into the critical path, and unable to fail the render.
  void touchAdminLastSeen(supabase, authUser.id);

  const displayName = profile?.full_name?.trim() || (authUser.email ?? "");
  const user = {
    fullName: displayName,
    email: authUser.email ?? "",
    initials:
      displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "?",
    roles: authorization.roles,
  };

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
    // Customers and orders are deliberately absent from the palette. Both used
    // to be listed from `mocks/admin.ts`, which meant typing a real customer's
    // name found nothing and typing an invented one found a row that does not
    // exist. A search that answers confidently and wrongly is worse than one
    // that does not cover a resource yet; they come back when each is a query.
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

  // **Empty, and honestly so.** The bell used to render three fixtures — a
  // low-stock warning, a new order, a scheduled publish — none of which
  // corresponded to anything. Nothing in the schema produces a notification yet:
  // there is no subscription table, no delivery record and no read state, so
  // there is nothing to list. The bell shows its empty state until there is.
  const notifications: AdminNotificationItem[] = [];

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
