"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import {
  ModuleStatusBadge,
  type ModuleStatusTone,
} from "@/components/admin/module/module-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Locale } from "@/lib/site-config";
import { formatDate } from "@/utils/format";

/**
 * The audit log.
 *
 * `public.audit_logs` is append-only and immutable even to `service_role`
 * (ADR-27), so this screen is read-only by construction — there are no row
 * actions because there is nothing an administrator is permitted to do to a
 * recorded event.
 */
/**
 * `audit_logs.action` is free text, not an enum — it is declared as such in
 * `scripts/check-enums.mjs`. So this is a partial lookup with a fallback rather
 * than an exhaustive record: a new action written by a future migration renders
 * neutrally instead of crashing the table.
 */
const ACTION_TONE: Partial<Record<string, ModuleStatusTone>> = {
  create: "success",
  update: "info",
  delete: "danger",
  login: "neutral",
  adjust: "warning",
};

/**
 * One row of `audit_logs`, as this screen renders it.
 *
 * Was `AuditEntry` from `types/admin`, which carried a localized `summary` the
 * fixtures wrote by hand. The real table has no summary column and should not:
 * an audit row records what happened in machine terms — action, resource, actor,
 * timestamp — and prose about it would be a second, editorialised copy of the
 * same fact.
 */
export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string;
  actorName: string;
  actorInitials: string;
  createdAt: string;
};

export function AuditTable({ entries }: { entries: readonly AuditRow[] }) {
  const t = useTranslations("adminSystem.audit");
  const locale = useLocale() as Locale;

  const columns: ModuleTableColumn<AuditRow>[] = [
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
        <ModuleStatusBadge tone={ACTION_TONE[entry.action] ?? "neutral"}>
          {/* The column is free text (declared in check-enums.mjs), so an
              action with no translation renders itself rather than a raw key
              or an empty cell. */}
          {t.has(`actions.${entry.action}`)
            ? t(`actions.${entry.action}`)
            : entry.action}
        </ModuleStatusBadge>
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
  ];

  return (
    <ModuleTable
      rows={entries}
      columns={columns}
      getRowId={(entry) => entry.id}
      searchIn={(entry) =>
        `${entry.actorName} ${entry.entityLabel} ${entry.entityType} ${entry.action}`
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
