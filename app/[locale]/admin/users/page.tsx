import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserPlus } from "lucide-react";

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { TeamManager } from "@/components/admin/system/team-manager";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/admin/permissions";
import { adminRoles, adminUsers, getAdminSession } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Team" };

export default async function AdminUsersPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, ["users.read", "admins.manage", "roles.manage"])) {
    notFound();
  }

  const t = await getTranslations("adminSystem.users");
  const canManage = can(permissions, "admins.manage");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />

      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            // Disabled with a stated reason rather than hidden: the capability
            // exists, the dependency does not.
            <Button disabled title={t("inviteUnavailable")}>
              <UserPlus aria-hidden="true" />
              {t("invite")}
            </Button>
          ) : null
        }
      />

      {canManage ? (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("inviteUnavailable")}
        </p>
      ) : null}

      <TeamManager
        members={adminUsers}
        roles={adminRoles}
        canManage={canManage}
      />
    </>
  );
}
