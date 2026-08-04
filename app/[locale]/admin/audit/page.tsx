import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { AuditTable } from "@/components/admin/system/audit-table";
import { can } from "@/lib/admin/permissions";
import { auditEntries, getAdminSession } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, "audit.read")) notFound();

  const t = await getTranslations("adminSystem.audit");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("appendOnly")}
      </p>

      <AuditTable entries={auditEntries} />
    </>
  );
}
