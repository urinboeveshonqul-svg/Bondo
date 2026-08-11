"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { requirePermission } from "@/lib/admin/action-guard";
import { ROLE_KEYS } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as usersService from "@/services/users.service";

/**
 * Team management.
 *
 * ## Three permissions, not one
 *
 * The three operations here are gated separately because the schema separates
 * them, and the difference is the point: `users.update` lets a colleague fix a
 * job title, `admins.manage` lets somebody revoke another administrator's
 * access, and `users.assign_roles` lets somebody make a colleague a super admin.
 * A single "manage team" gate would collapse the third into the first.
 *
 * `users.assign_roles` and not `roles.manage`: the latter is for editing what a
 * role *is*, and it is `user_roles` that the RLS policy guards with the former.
 * Asking for the wrong one here would produce a screen whose button is enabled
 * and whose write is refused.
 */

function revalidateTeam(): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}${routes.admin.users}`);
  }
}

export const setAdminActive = createAction(
  "setAdminActive",
  z.object({ userId: z.uuid(), isActive: z.boolean() }),
  async (input) => {
    const { userId: actorId } = await requirePermission("admins.manage");

    // Locking yourself out is not a decision anybody makes on purpose, and the
    // recovery needs another super admin or a migration. RLS cannot express
    // "except yourself", so it is refused here.
    if (actorId === input.userId && !input.isActive) {
      throw new Error("adminSystem.users.errors.cannotDisableSelf");
    }

    const supabase = await createClient();
    await usersService.setAdminActive(supabase, input.userId, input.isActive);

    revalidateTeam();

    return { isActive: input.isActive };
  },
);

export const updateAdminJobTitle = createAction(
  "updateAdminJobTitle",
  z.object({
    userId: z.uuid(),
    jobTitle: z.string().trim().max(120),
  }),
  async (input) => {
    await requirePermission("users.update");

    const supabase = await createClient();
    await usersService.updateAdminJobTitle(
      supabase,
      input.userId,
      input.jobTitle.length > 0 ? input.jobTitle : null,
    );

    revalidateTeam();

    return { jobTitle: input.jobTitle };
  },
);

export const setAdminRoles = createAction(
  "setAdminRoles",
  z.object({
    userId: z.uuid(),
    // Validated against the five keys the schema protects from rename by a
    // trigger (ADR-44), so a typo fails here rather than as a silent no-grant.
    roleKeys: z.array(z.enum(ROLE_KEYS)).max(ROLE_KEYS.length),
  }),
  async (input) => {
    const { userId: actorId } = await requirePermission("users.assign_roles");

    // Same reasoning as disabling yourself: dropping your own super-admin grant
    // is a one-way door, and the panel is the only way back through it.
    if (actorId === input.userId) {
      throw new Error("adminSystem.users.errors.cannotChangeOwnRoles");
    }

    const supabase = await createClient();
    await usersService.setAdminRoles(supabase, input.userId, input.roleKeys);

    revalidateTeam();

    return { roles: input.roleKeys.length };
  },
);
