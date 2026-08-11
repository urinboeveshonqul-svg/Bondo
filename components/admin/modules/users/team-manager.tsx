"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setAdminActive, setAdminRoles } from "@/actions/users.actions";
import { useRouter } from "@/i18n/navigation";
import type { RoleKey } from "@/lib/admin/permissions";
import type { ModuleCapabilities } from "@/lib/admin/module";
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
  capabilities,
}: {
  members: readonly AdminUser[];
  roles: readonly AdminRole[];
  capabilities: ModuleCapabilities;
}) {
  // Managing the team is `admins.manage` — the registry maps it to `create`,
  // because adding a colleague is what the permission is for.
  const canManage = capabilities.create;
  /*
    Two capabilities, not one. `delete` maps to `admins.manage` in the registry
    and is what revoking access needs; `settings` maps to `users.assign_roles`
    and is what changing somebody's roles needs. Collapsing them would offer a
    role editor to whoever can disable an account, which is the more dangerous
    of the two permissions to widen.
  */
  const canDisable = capabilities.delete;
  const canAssignRoles = capabilities.settings;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assigning, setAssigning] = useState<AdminUser | null>(null);
  const [draftRoles, setDraftRoles] = useState<RoleKey[]>([]);

  function toggleActive(member: AdminUser) {
    startTransition(async () => {
      const result = await setAdminActive({
        userId: member.userId,
        isActive: !member.isActive,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      router.refresh();
    });
  }

  function saveRoles() {
    if (!assigning) return;

    startTransition(async () => {
      const result = await setAdminRoles({
        userId: assigning.userId,
        roleKeys: draftRoles,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      setAssigning(null);
      router.refresh();
    });
  }
  const t = useTranslations("adminSystem.users");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const roleName = (key: string) =>
    roles.find((role) => role.key === key)?.name[locale] ?? key;

  const columns: ModuleTableColumn<AdminUser>[] = [
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
            <ModuleStatusBadge key={key} tone="info">
              {roleName(key)}
            </ModuleStatusBadge>
          ))}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      sortValue: (member) => (member.isActive ? 1 : 0),
      cell: (member) => (
        <ModuleStatusBadge tone={member.isActive ? "success" : "muted"}>
          {member.isActive
            ? tAdmin("status.active")
            : tAdmin("status.inactive")}
        </ModuleStatusBadge>
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

  if (canDisable || canAssignRoles) {
    columns.push({
      id: "actions",
      header: tAdmin("columns.actions"),
      cell: (member) => (
        <div className="flex items-center justify-end gap-1">
          {canAssignRoles ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setAssigning(member);
                setDraftRoles([...member.roles]);
              }}
            >
              {t("roles.assign")}
            </Button>
          ) : null}
          {canDisable ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => toggleActive(member)}
            >
              {member.isActive
                ? tAdmin("actions.disable")
                : tAdmin("actions.enable")}
            </Button>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">{t("tabs.members")}</TabsTrigger>
        <TabsTrigger value="roles">{t("tabs.roles")}</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-4 space-y-3">
        <ModuleTable
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
                      <ModuleStatusBadge tone="neutral">
                        {t("roles.system")}
                      </ModuleStatusBadge>
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
      <Dialog
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
      >
        <DialogContent className="sm:max-w-md">
          {assigning ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("roles.assign")}</DialogTitle>
                <DialogDescription>
                  {t("roles.assignHint", { name: assigning.fullName })}
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-2">
                {roles.map((role) => (
                  <li
                    key={role.key}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={`role-${role.key}`}
                      checked={draftRoles.includes(role.key)}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        setDraftRoles((current) =>
                          checked
                            ? [...current, role.key]
                            : current.filter((key) => key !== role.key),
                        )
                      }
                    />
                    <div className="min-w-0 space-y-0.5">
                      <Label
                        htmlFor={`role-${role.key}`}
                        className="font-medium"
                      >
                        {role.name[locale]}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {role.description[locale]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssigning(null)}
                >
                  {tAdmin("actions.cancel")}
                </Button>
                <Button type="button" disabled={pending} onClick={saveRoles}>
                  {tAdmin("actions.save")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
