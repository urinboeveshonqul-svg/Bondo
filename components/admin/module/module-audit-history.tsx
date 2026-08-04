import { useLocale, useTranslations } from "next-intl";
import { History } from "lucide-react";

import { ModuleEmptyState } from "@/components/admin/module/module-empty-state";
import {
  ModuleStatusBadge,
  type ModuleStatusTone,
} from "@/components/admin/module/module-status-badge";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditEntry } from "@/types/admin";
import { formatDate } from "@/utils/format";

/**
 * Who changed this record, when, and to what.
 *
 * Every module that mutates anything gets one — declared as `audit: true` in
 * the registry — because the question an operator asks about a wrong price is
 * never "what is it now" but "who set it and when". Rendered from
 * `public.audit_logs`, which is append-only and immutable even to
 * `service_role` (ADR-27): a history anybody can rewrite answers nothing.
 *
 * An ordered list, newest first, with the timestamp in a `<time>` element so it
 * is machine-readable and locale-formatted at the same time. The action is a
 * badge **and** a word — colour alone does not distinguish a delete from an
 * update for a third of colour-deficient readers.
 *
 * No `"use client"`: `useTranslations` and `useLocale` work in Server
 * Components, so a history of forty entries ships as markup.
 */
const ACTION_TONE: Record<AuditAction, ModuleStatusTone> = {
  create: "success",
  update: "info",
  delete: "danger",
  login: "neutral",
  adjust: "warning",
};

export function ModuleAuditHistory({
  entries,
  title,
  limit,
  className,
}: {
  entries: readonly AuditEntry[];
  /** Overrides the default heading — e.g. "Recent activity" on a dashboard. */
  title?: string;
  /** Shows only the newest `limit` entries. Omit for all of them. */
  limit?: number;
  className?: string;
}) {
  const t = useTranslations("admin.history");
  const locale = useLocale() as Locale;

  const sorted = [...entries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const visible = typeof limit === "number" ? sorted.slice(0, limit) : sorted;
  const headingId = "module-audit-history";

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}
    >
      <div className="mb-4 space-y-1">
        <h2 id={headingId} className="font-semibold tracking-tight">
          {title ?? t("title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {visible.length === 0 ? (
        <ModuleEmptyState
          icon={History}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <ol className="space-y-4">
          {visible.map((entry) => (
            <li key={entry.id} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
              >
                {entry.actorInitials}
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ModuleStatusBadge tone={ACTION_TONE[entry.action]}>
                    {t(`actions.${entry.action}`)}
                  </ModuleStatusBadge>
                  <span className="truncate text-sm font-medium">
                    {entry.entityLabel}
                  </span>
                </div>

                <p className="text-sm text-pretty text-muted-foreground">
                  {entry.summary[locale]}
                </p>

                <p className="text-xs text-muted-foreground">
                  {t("by", { name: entry.actorName })} ·{" "}
                  <time dateTime={entry.createdAt}>
                    {formatDate(entry.createdAt, locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
