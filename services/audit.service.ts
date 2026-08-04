import type { SupabaseClient } from "@supabase/supabase-js";

import { toAppError } from "@/lib/supabase-error";
import type { Database, Json, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * The audit log.
 *
 * `audit_logs` is append-only, enforced by a trigger that rejects `update` and
 * `delete` **for every role including `service_role`** (ADR-27) — RLS does not
 * constrain the service role, so a policy alone would leave the log rewritable
 * by anyone holding the service key, which is not evidence of anything.
 *
 * There is therefore deliberately no `updateAuditEntry` or `deleteAuditEntry`
 * in this file. A correction is a new entry.
 */

export type AuditRow = Tables<"audit_logs">;

export type AuditListParams = {
  page?: number;
  pageSize?: number;
  action?: string;
  /** Matches `audit_logs.resource_type`, e.g. `"product"`. */
  resourceType?: string;
  actorId?: string;
  /** ISO 8601. */
  since?: string;
};

export async function listAuditEntries(
  supabase: Client,
  params: AuditListParams = {},
): Promise<{ rows: AuditRow[]; total: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.action) query = query.eq("action", params.action);
  if (params.resourceType)
    query = query.eq("resource_type", params.resourceType);
  if (params.actorId) query = query.eq("actor_id", params.actorId);
  if (params.since) query = query.gte("created_at", params.since);

  const { data, error, count } = await query;
  if (error) throw toAppError(error, "read the audit log");

  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * Writes an audit entry.
 *
 * Called by Server Actions after a successful mutation, not by services — a
 * service does not know whether its caller is a user action worth recording or
 * an internal read-repair.
 *
 * Failures are **swallowed deliberately**. An audit write that fails must not
 * roll back the operation it describes: the product really was updated, and
 * throwing here would tell the operator it was not. The failure is logged
 * instead, which is the honest trade — a gap in the log is recoverable, a lie
 * about whether the write happened is not.
 */
export async function recordAudit(
  supabase: Client,
  entry: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    changes?: Json;
    metadata?: Json;
  },
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    changes: entry.changes ?? null,
    metadata: entry.metadata ?? null,
  });

  if (error) {
    console.error("[audit] failed to record entry", {
      action: entry.action,
      resourceType: entry.resourceType,
      code: error.code,
    });
  }
}
