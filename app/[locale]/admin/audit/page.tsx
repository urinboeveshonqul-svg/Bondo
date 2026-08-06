import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { AuditTable } from "@/components/admin/modules/audit/audit-table";
import { createClient } from "@/supabase/server";
import * as auditService from "@/services/audit.service";
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

  // The real log. `audit.read` is what the policy checks, and `guardModule`
  // above already refused anybody without it.
  const supabase = await createClient();
  const { rows } = await auditService.listAuditEntries(supabase, {
    pageSize: 100,
  });

  const entries = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.resource_type,
    // The log stores the id, not a name — resolving one would mean a join per
    // row against a table the entry may outlive. The id is what an operator
    // pastes into a lookup anyway.
    entityLabel: row.resource_id ?? "—",
    actorName: row.actor_email ?? t("systemActor"),
    actorInitials: (row.actor_email ?? "?").slice(0, 2).toUpperCase(),
    createdAt: row.created_at,
  }));

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

      <AuditTable entries={entries} />
    </>
  );
}
