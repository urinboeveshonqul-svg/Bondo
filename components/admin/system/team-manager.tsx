"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/data-table/data-table";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_PERMISSIONS } from "@/lib/admin/permissions";
import type { Locale } from "@/lib/site-config";
import type { AdminRole, AdminUser } from "@/types/admin";
import { formatDate } from "@/utils/format";

/**
 * Administrators and roles.
 *
 * The roles tab renders the **actual grant table** from
 * `lib/admin/permissions.ts`, which is transcribed from the migration. That
 * makes the screen a readable statement of the authorisation model rather than a
 * second description of it that can drift — if a grant changes in the migration
 * and not in the constant, this page shows the discrepancy.
 *
 * Deactivating rather than deleting is the modelled path for someone leaving:
 * `admins.is_active = false` revokes access immediately while keeping their name
 * attached to everything they did in the audit log.
 */
export function TeamManager({
  members,
  roles,
  canManage,
}: {
  members: readonly AdminUser[];
  roles: readonly AdminRole[];
  canManage: boolean;
}) {
  const t = useTranslations("adminSystem.users");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const roleName = (key: string) =>
    roles.find((role) => role.key === key)?.name[locale] ?? key;

  const columns: DataTableColumn<AdminUser>[] = [
    {
      id: "member",
      header: t("columns.member"),
      sortValue: (member) => member.fullName,
      cell: (member) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs">
              {member.initials}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {member.fullName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {member.email}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "roles",
      header: t("columns.roles"),
      cell: (member) => (
        <span className="flex flex-wrap gap-1">
          {member.roles.map((key) => (
            <StatusBadge key={key} tone="info">
              {roleName(key)}
            </StatusBadge>
          ))}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      sortValue: (member) => (member.isActive ? 1 : 0),
      cell: (member) => (
        <StatusBadge tone={member.isActive ? "success" : "muted"}>
          {member.isActive
            ? tAdmin("status.active")
            : tAdmin("status.inactive")}
        </StatusBadge>
      ),
    },
    {
      id: "lastSeen",
      header: t("columns.lastSeen"),
      hideOnMobile: true,
      sortValue: (member) => member.lastSeenAt ?? "",
      cell: (member) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {member.lastSeenAt
            ? formatDate(member.lastSeenAt, locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : tAdmin("never")}
        </span>
      ),
    },
  ];

  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
        <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4 space-y-3">
        <DataTable
          rows={members}
          columns={columns}
          getRowId={(member) => member.id}
          searchIn={(member) =>
            `${member.fullName} ${member.email} ${member.jobTitle}`
          }
          emptyTitle={t("emptyTitle")}
          emptyDescription={t("emptyDescription")}
        />

        <p className="text-xs text-muted-foreground">
          {t("deactivatedNote")}
          {canManage ? "" : ` ${tAdmin("readOnly.body")}`}
        </p>
      </TabsContent>

      <TabsContent value="roles" className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("roles.description")}
        </p>

        <Accordion type="multiple" className="space-y-2">
          {roles.map((role) => {
            const granted = ROLE_PERMISSIONS[role.key];

            return (
              <AccordionItem
                key={role.key}
                value={role.key}
                className="rounded-xl border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-start">
                    <span className="font-medium">{role.name[locale]}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {role.key}
                    </span>
                    {role.isSystem ? (
                      <StatusBadge tone="neutral">
                        {t("roles.system")}
                      </StatusBadge>
                    ) : null}
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t("roles.permissionCount", { count: granted.length })}
                    </span>
                  </span>
                </AccordionTrigger>

                <AccordionContent className="space-y-3 pb-4">
                  <p className="text-sm text-muted-foreground">
                    {role.description[locale]}
                  </p>

                  <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {granted.map((permission) => (
                      <li
                        key={permission}
                        className="flex items-baseline gap-2 rounded-md bg-muted/50 px-2 py-1.5"
                      >
                        <span className="text-sm">
                          {t(`permissions.${permission}`)}
                        </span>
                        <span className="ms-auto font-mono text-[0.65rem] text-muted-foreground">
                          {permission}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </TabsContent>
    </Tabs>
  );
}
