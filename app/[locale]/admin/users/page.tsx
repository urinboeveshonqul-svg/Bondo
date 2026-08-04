import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserPlus } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { TeamManager } from "@/components/admin/modules/users/team-manager";
import { Button } from "@/components/ui/button";
import { adminRoles, adminUsers } from "@/mocks/admin";
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
        members={adminUsers}
        roles={adminRoles}
        capabilities={capabilities}
      />
    </>
  );
}
