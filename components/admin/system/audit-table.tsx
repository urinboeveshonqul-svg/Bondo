"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/data-table/data-table";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/admin/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/site-config";
import type { AuditAction, AuditEntry } from "@/types/admin";
import { formatDate } from "@/utils/format";

/**
 * The audit log.
 *
 * `public.audit_logs` is append-only and immutable even to `service_role`
 * (ADR-27), so this screen is read-only by construction — there are no row
 * actions because there is nothing an administrator is permitted to do to a
 * recorded event.
 */
const ACTION_TONE: Record<AuditAction, StatusTone> = {
  create: "success",
  update: "info",
  delete: "danger",
  login: "neutral",
  adjust: "warning",
};

export function AuditTable({ entries }: { entries: readonly AuditEntry[] }) {
  const t = useTranslations("adminSystem.audit");
  const locale = useLocale() as Locale;

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      id: "when",
      header: t("columns.when"),
      sortValue: (entry) => entry.createdAt,
      cell: (entry) => (
        <span className="text-xs whitespace-nowrap">
          {formatDate(entry.createdAt, locale, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      ),
    },
    {
      id: "actor",
      header: t("columns.actor"),
      sortValue: (entry) => entry.actorName,
      cell: (entry) => (
        <span className="flex items-center gap-2">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[0.6rem]">
              {entry.actorInitials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{entry.actorName}</span>
        </span>
      ),
    },
    {
      id: "action",
      header: t("columns.action"),
      sortValue: (entry) => entry.action,
      cell: (entry) => (
        <StatusBadge tone={ACTION_TONE[entry.action]}>
          {t(`actions.${entry.action}`)}
        </StatusBadge>
      ),
    },
    {
      id: "entity",
      header: t("columns.entity"),
      hideOnMobile: true,
      sortValue: (entry) => entry.entityLabel,
      cell: (entry) => (
        <span className="min-w-0">
          <span className="block truncate text-sm">{entry.entityLabel}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {entry.entityType}
          </span>
        </span>
      ),
    },
    {
      id: "summary",
      header: t("columns.summary"),
      cell: (entry) => (
        <span className="text-sm text-muted-foreground">
          {entry.summary[locale]}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      rows={entries}
      columns={columns}
      getRowId={(entry) => entry.id}
      searchIn={(entry) =>
        `${entry.actorName} ${entry.entityLabel} ${entry.entityType} ${entry.summary[locale]}`
      }
      initialSort={{ columnId: "when", direction: "desc" }}
      filters={[
        {
          id: "action",
          label: t("filters.action"),
          options: (
            ["create", "update", "delete", "adjust", "login"] as const
          ).map((action) => ({
            value: action,
            label: t(`actions.${action}`),
          })),
          match: (entry, value) => entry.action === value,
        },
      ]}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
    />
  );
}
