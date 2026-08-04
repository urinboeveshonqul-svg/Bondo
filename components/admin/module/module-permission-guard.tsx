import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";

import {
  canModule,
  canOpenModule,
  capabilitiesOf,
  type ModuleCapability,
} from "@/lib/admin/module";
import { adminModule } from "@/lib/admin/modules";
import type { AdminModuleId } from "@/lib/admin/module";
import type { Permission } from "@/lib/admin/permissions";

/**
 * The gate at the top of every module route.
 *
 * **Hiding navigation is a usability measure, not an access control.** The
 * sidebar already omits a module an administrator cannot use, but a URL typed
 * directly, pasted from a colleague or restored from history bypasses the
 * sidebar entirely. Every route repeats the check, and this component is how it
 * gets repeated identically rather than approximately.
 *
 * It answers with `notFound()` rather than a 403. A 403 confirms the route
 * exists, which tells someone probing exactly which module to go phishing for
 * credentials against; a 404 tells them nothing they did not already know.
 *
 * > **This is not the authorisation boundary.** RLS is (ADR-4). This check runs
 * > against a permission set that is currently a fixture and will become a
 * > database read; it stops an administrator wandering into a screen they cannot
 * > use, and it would not stop an attacker who forged one. **K-1** is the real
 * > gate and it is still open.
 *
 * Usage — the whole guard is the first thing in the page body:
 *
 * ```tsx
 * const { permissions } = getAdminSession();
 * const can = await guardModule("products", permissions);
 * ```
 */
export async function guardModule(
  id: AdminModuleId,
  permissions: ReadonlySet<Permission>,
  /** Require more than "may open this module" — e.g. `create` on a new-record route. */
  capability?: ModuleCapability,
) {
  const definition = adminModule(id);

  const allowed = capability
    ? canModule(permissions, definition, capability)
    : canOpenModule(permissions, definition);

  if (!allowed) notFound();

  return capabilitiesOf(permissions, definition);
}

/**
 * The banner shown to an administrator who may look but not touch.
 *
 * Read-only is stated rather than implied by absent buttons. Someone who has
 * been told they can edit products and finds no Save is left assuming the panel
 * is broken; a support agent who knows their role is read-only reads one line
 * and moves on.
 */
export async function ModuleReadOnlyNotice({
  id,
  permissions,
}: {
  id: AdminModuleId;
  permissions: ReadonlySet<Permission>;
}) {
  const definition = adminModule(id);
  const capabilities = capabilitiesOf(permissions, definition);

  // Nothing to say when there was never anything to edit: the audit log grants
  // no update to anybody, so calling it "read only" implies a restriction on
  // this person rather than on the table.
  const editable =
    definition.grants.update !== null || definition.grants.create !== null;
  if (!editable || capabilities.update || capabilities.create) return null;

  const t = await getTranslations("admin.readOnly");

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
    >
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">{t("badge")}</span>{" "}
        {t("body")}
      </span>
    </p>
  );
}
