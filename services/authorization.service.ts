import "server-only";

import { cache } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toAppError } from "@/lib/supabase-error";
import type { Permission, RoleKey } from "@/lib/admin/permissions";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Who someone is, and what they may do — **read from the database**.
 *
 * This replaces `getAdminSession()` in `mocks/admin.ts`, which returned a
 * fixture. It is the difference between an interface that renders a permission
 * model and one that enforces it.
 *
 * ## The model, restated because it is unusual
 *
 * A **customer** holds no role. Being a customer is the absence of an `admins`
 * row, and every customer-facing policy keys off `auth.uid() = user_id` rather
 * than a role (ADR-21, ADR-22, ADR-59). So `roles` is empty for the
 * overwhelming majority of accounts, and that is correct rather than a missing
 * grant.
 *
 * **Staff** hold roles; roles hold permissions. A deactivated admin
 * (`is_active = false`) resolves to zero permissions immediately, without any
 * row being deleted — verified in Phase 2, and the reason `is_active` is
 * checked here rather than only at sign-in.
 *
 * ## What this is and is not
 *
 * It is the input to what the interface *renders*. **It is not the
 * authorisation boundary** — RLS is (ADR-4). Every query these permissions gate
 * is also refused by a policy if the check here were wrong or bypassed, which is
 * what makes it safe for this to be a convenience rather than a gate.
 *
 * The read runs as the **calling user** through the RLS-enforced client, never
 * the service role. A user may read their own `user_roles` and `admins` rows;
 * asking about somebody else returns nothing, which is the correct answer and
 * not an error.
 */

export type Authorization = {
  userId: string;
  /** `true` only for an active, non-deleted `admins` row. */
  isAdmin: boolean;
  roles: readonly RoleKey[];
  permissions: ReadonlySet<Permission>;
};

/** Nobody: a signed-out visitor, or a signed-in customer asking about staff. */
export const NO_AUTHORIZATION: Omit<Authorization, "userId"> = {
  isAdmin: false,
  roles: [],
  permissions: new Set<Permission>(),
};

/**
 * Resolves roles and permissions for one user.
 *
 * Memoised per request with React `cache()`, the same treatment
 * `getCurrentUser()` gets (ADR-12): the admin layout, the page and every
 * guarded control ask the same question, and they should cost one round trip
 * rather than one each.
 *
 * Two queries rather than one join, deliberately. PostgREST can embed
 * `user_roles → roles → role_permissions → permissions` in a single request,
 * but the resulting shape is four levels of nullable arrays that have to be
 * flattened defensively anyway, and the `admins` lookup is a different question
 * with a different answer for the same user. Two small indexed reads are
 * cheaper to understand and no slower in practice.
 */
export const authorizationFor = cache(
  async (supabase: Client, userId: string): Promise<Authorization> => {
    const [adminResult, roleResult] = await Promise.all([
      supabase
        .from("admins")
        .select("id, is_active, deleted_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select(
          "role:roles ( key, role_permissions ( permission:permissions ( key ) ) )",
        )
        .eq("user_id", userId),
    ]);

    if (adminResult.error) {
      throw toAppError(adminResult.error, "check administrator status");
    }
    if (roleResult.error) {
      throw toAppError(roleResult.error, "read your permissions");
    }

    const isAdmin = adminResult.data?.is_active === true;

    const roles: RoleKey[] = [];
    const permissions = new Set<Permission>();

    for (const row of roleResult.data ?? []) {
      const role = row.role;
      if (!role) continue;

      roles.push(role.key as RoleKey);

      for (const grant of role.role_permissions ?? []) {
        const key = grant.permission?.key;
        if (key) permissions.add(key as Permission);
      }
    }

    // A deactivated administrator keeps their rows and loses every capability.
    // Returning the roles but not the permissions would let the interface show
    // "Catalog manager" beside a panel that refuses every action, so both go.
    if (!isAdmin) {
      return { userId, isAdmin: false, roles: [], permissions: new Set() };
    }

    return { userId, isAdmin, roles, permissions };
  },
);

/**
 * Records that an administrator was seen, for the team screen's "last active".
 *
 * Failure is swallowed on purpose, the same way `recordAudit` swallows its own:
 * a telemetry write must never be the reason somebody cannot open the admin
 * panel. It is also not awaited by the caller's critical path.
 */
export async function touchAdminLastSeen(
  supabase: Client,
  userId: string,
): Promise<void> {
  await supabase
    .from("admins")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId);
}
