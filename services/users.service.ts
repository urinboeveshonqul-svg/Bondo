import type { SupabaseClient } from "@supabase/supabase-js";

import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { Database, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Administrators, roles and grants.
 *
 * ## Administrators are not customers
 *
 * `public.admins` is the staff table: a row there is what `is_admin()` tests and
 * what the panel's route guard requires. `public.profiles` holds a display name
 * for **every** signed-up person, customers included. Joining the two is what
 * makes this screen a staff list rather than a customer list — a mistake worth
 * naming, because "list the profiles" is the obvious query and gives you every
 * shopper who ever registered.
 *
 * ## What is not here: email addresses
 *
 * An email lives in `auth.users`, which PostgREST does not expose and which no
 * RLS policy can grant. Reading it needs the service role, and using the service
 * role to populate a staff list means the panel reads with privileges the
 * operator does not have — precisely the bypass this codebase refuses (ADR-4).
 * So the team screen identifies people by name and job title, and an operator
 * who needs an address asks the person.
 */

export type AdminRecord = Tables<"admins"> & {
  fullName: string | null;
  roleKeys: string[];
};

/**
 * Every administrator, with their display name and role keys.
 *
 * Three reads rather than one embedded select: `admins.user_id` points at
 * `auth.users`, not at `profiles`, so PostgREST has no foreign key to follow
 * between them and cannot embed one in the other. The join is done here on ids
 * the caller already holds.
 */
export async function listAdmins(supabase: Client): Promise<AdminRecord[]> {
  const { data: admins, error } = await supabase
    .from("admins")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw toAppError(error, "load the team");
  if (!admins || admins.length === 0) return [];

  const userIds = admins.map((admin) => admin.user_id);

  const [profiles, grants] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", userIds),
    supabase
      .from("user_roles")
      .select("user_id, role:roles ( key )")
      .in("user_id", userIds),
  ]);

  if (profiles.error) throw toAppError(profiles.error, "load the team");
  if (grants.error) throw toAppError(grants.error, "load the team");

  const nameByUser = new Map(
    (profiles.data ?? []).map((row) => [row.id, row.full_name]),
  );

  const rolesByUser = new Map<string, string[]>();
  for (const row of grants.data ?? []) {
    const key = (row.role as { key: string } | null)?.key;
    if (!key) continue;
    rolesByUser.set(row.user_id, [
      ...(rolesByUser.get(row.user_id) ?? []),
      key,
    ]);
  }

  return admins.map((admin) => ({
    ...admin,
    fullName: nameByUser.get(admin.user_id) ?? null,
    roleKeys: rolesByUser.get(admin.user_id) ?? [],
  }));
}

export type RoleRecord = Tables<"roles"> & { memberCount: number };

/** The roles, with how many people hold each. */
export async function listRoles(supabase: Client): Promise<RoleRecord[]> {
  const [roles, grants] = await Promise.all([
    supabase.from("roles").select("*").order("key"),
    supabase.from("user_roles").select("role_id"),
  ]);

  if (roles.error) throw toAppError(roles.error, "load the roles");
  if (grants.error) throw toAppError(grants.error, "load the roles");

  const counts = new Map<string, number>();
  for (const row of grants.data ?? []) {
    counts.set(row.role_id, (counts.get(row.role_id) ?? 0) + 1);
  }

  return (roles.data ?? []).map((role) => ({
    ...role,
    memberCount: counts.get(role.id) ?? 0,
  }));
}

/**
 * Enables or disables an administrator.
 *
 * Disabling rather than deleting: `is_admin()` tests `is_active`, so this
 * revokes access immediately while leaving the audit trail attributable. A
 * deleted row would orphan every `audit_logs` entry that names the actor.
 */
export async function setAdminActive(
  supabase: Client,
  userId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("admins")
    .update({ is_active: isActive })
    .eq("user_id", userId);

  if (error) throw toAppError(error, "update the administrator");
}

/** The job title shown beside a name on the team screen. */
export async function updateAdminJobTitle(
  supabase: Client,
  userId: string,
  jobTitle: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("admins")
    .update({ job_title: jobTitle })
    .eq("user_id", userId);

  if (error) throw toAppError(error, "update the administrator");
}

/**
 * Replaces an administrator's roles with exactly the set given.
 *
 * Delete-then-insert rather than a diff, and the order matters: the pair
 * `(user_id, role_id)` is the primary key, so inserting a grant that already
 * exists is a conflict rather than a no-op. Sending the whole set also makes the
 * call idempotent, which matters when two people edit the same colleague.
 *
 * The window between the two statements is a real risk and is bounded by RLS
 * rather than by this function: only `users.assign_roles` reaches either
 * statement, and a failure between them leaves the person with no roles — locked
 * out rather than over-privileged, which is the safe direction to fail.
 */
export async function setAdminRoles(
  supabase: Client,
  userId: string,
  roleKeys: readonly string[],
): Promise<void> {
  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("id, key")
    .in("key", roleKeys.length > 0 ? [...roleKeys] : ["__none__"]);

  if (rolesError) throw toAppError(rolesError, "assign the roles");

  if (roleKeys.length > 0 && (roles?.length ?? 0) !== roleKeys.length) {
    // A key the table does not have. Refusing here names the problem; letting
    // it through would silently grant fewer roles than the operator selected.
    throw notFoundOrForbidden("Role");
  }

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw toAppError(deleteError, "assign the roles");

  if (!roles || roles.length === 0) return;

  const { error: insertError } = await supabase.from("user_roles").insert(
    roles.map((role) => ({
      user_id: userId,
      role_id: role.id,
    })),
  );

  if (insertError) throw toAppError(insertError, "assign the roles");
}
