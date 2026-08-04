import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { AuditTable } from "@/components/admin/modules/audit/audit-table";
import { auditEntries } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Every module route opens the same three lines: resolve the session, guard
  // the module, render against the capabilities that come back. The audit log
  // grants none beyond reading, so there is nothing to hold on to.
  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  await guardModule("audit", permissions);

  const t = await getTranslations("adminSystem.audit");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("appendOnly")}
      </p>

      <AuditTable entries={auditEntries} />
    </>
  );
}
