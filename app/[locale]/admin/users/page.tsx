import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { UserPlus } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { TeamManager } from "@/components/admin/modules/users/team-manager";
import { Button } from "@/components/ui/button";
import { createClient } from "@/supabase/server";
import * as usersService from "@/services/users.service";
import type { RoleKey } from "@/lib/admin/permissions";
import type { AdminRole, AdminUser } from "@/types/admin";
import { locales, type Locale } from "@/lib/site-config";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Team" };

export default async function AdminUsersPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("users", permissions);

  const t = await getTranslations("adminSystem.users");
  const activeLocale = (await getLocale()) as Locale;

  const supabase = await createClient();
  const [adminRows, roleRows] = await Promise.all([
    usersService.listAdmins(supabase),
    usersService.listRoles(supabase),
  ]);

  /* Initials from the display name, or from the job title when a colleague has
     not filled one in. Never from an email — the panel cannot read one. */
  const initialsOf = (name: string | null) =>
    (name ?? "")
      .split(/s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "—";

  const members: AdminUser[] = adminRows.map((admin) => ({
    id: admin.id,
    userId: admin.user_id,
    fullName: admin.fullName ?? t("unnamed"),
    // `auth.users.email` is not reachable without the service role, and reading
    // the team list with privileges the operator does not hold is the bypass
    // this codebase refuses (ADR-4). The column stays empty rather than faked.
    email: "",
    initials: initialsOf(admin.fullName),
    jobTitle: admin.job_title ?? "",
    roles: admin.roleKeys as RoleKey[],
    isActive: admin.is_active,
    lastSeenAt: admin.last_seen_at,
    createdAt: admin.created_at,
  }));

  const roles: AdminRole[] = roleRows.map((role) => ({
    key: role.key as RoleKey,
    // `roles.name` and `roles.description` are single-language columns in the
    // schema, so the same string is shown in all three. Localizing them is a
    // migration (a `role_translations` table), not something to fake here.
    name: Object.fromEntries(
      locales.map((each) => [each, role.name]),
    ) as AdminRole["name"],
    description: Object.fromEntries(
      locales.map((each) => [each, role.description ?? ""]),
    ) as AdminRole["description"],
    isSystem: role.is_system,
    memberCount: role.memberCount,
  }));

  void activeLocale;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
        actions={
          capabilities.create ? (
            // Disabled with a stated reason rather than hidden: the capability
            // exists, the dependency does not.
            <Button disabled title={t("inviteUnavailable")}>
              <UserPlus aria-hidden="true" />
              {t("invite")}
            </Button>
          ) : null
        }
      />

      {capabilities.create ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("inviteUnavailable")}
        </p>
      ) : null}

      <TeamManager
        members={members}
        roles={roles}
        capabilities={capabilities}
      />
    </>
  );
}
