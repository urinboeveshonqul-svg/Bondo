import { AppError, type AppErrorCode } from "@/lib/errors";

/**
 * Translates a Supabase/PostgREST failure into an `AppError`.
 *
 * Services must never return a raw Postgres error: the message carries the SQL,
 * the constraint name and often the column values, and PostgREST passes it
 * through verbatim. One mapper means every service reports the same failure the
 * same way, and the details stay in `cause` where the logger can see them and
 * the client cannot.
 *
 * The distinction that matters most here is **`42501` and an empty result are
 * not the same thing**. RLS does not raise on a denied `select` — it filters the
 * row out, so a permission failure and a genuinely missing row are both "no
 * rows". Callers that need to tell them apart have to ask a question the policy
 * allows; `notFoundOrForbidden` names that ambiguity rather than papering over
 * it.
 */

/** Postgres error codes worth distinguishing. */
const CODE_MAP: Record<string, { code: AppErrorCode; message: string }> = {
  // Unique violation — a slug or SKU that already exists.
  "23505": { code: "conflict", message: "That value is already in use." },
  // Foreign key violation — referencing a row that does not exist, or deleting
  // one that is still referenced.
  "23503": {
    code: "validation",
    message: "That reference does not exist, or the record is still in use.",
  },
  // Not-null violation.
  "23502": { code: "validation", message: "A required field is missing." },
  // Check constraint — e.g. a sale price above the list price.
  "23514": { code: "validation", message: "That value is not allowed." },
  // Insufficient privilege. RLS raises this for writes; reads are filtered.
  "42501": {
    code: "forbidden",
    message: "You do not have permission to do that.",
  },
  // Raised by the append-only triggers on audit_logs and inventory_movements.
  P0001: { code: "forbidden", message: "That record cannot be changed." },
  // PostgREST: no rows returned by `.single()`.
  PGRST116: { code: "not_found", message: "Not found." },
  // Undefined table/column — a schema that has drifted from the generated types.
  "42P01": { code: "internal", message: "The database schema is out of date." },
  "42703": { code: "internal", message: "The database schema is out of date." },
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * @param error the `error` field of a Supabase response.
 * @param context what was being attempted, used only for the log line.
 */
export function toAppError(
  error: SupabaseErrorLike,
  context: string,
): AppError {
  const mapped = error.code ? CODE_MAP[error.code] : undefined;

  if (mapped) {
    return new AppError(mapped.code, mapped.message, { cause: error });
  }

  // A fetch failure surfaces with no Postgres code — the database is
  // unreachable rather than unhappy, which is an upstream problem.
  if (!error.code && /fetch|network|ECONN|timeout/i.test(error.message ?? "")) {
    return new AppError("upstream", "The database is unreachable.", {
      cause: error,
    });
  }

  return new AppError("internal", `Could not ${context}.`, { cause: error });
}

/**
 * The result of a read that returned nothing.
 *
 * Deliberately `not_found` rather than `forbidden`: RLS filters denied rows
 * rather than raising, so the two are indistinguishable from here, and
 * answering "forbidden" would confirm the row exists to someone not allowed to
 * know that. Reporting "not found" is both accurate from the caller's
 * perspective and the safer disclosure.
 */
export function notFoundOrForbidden(what: string): AppError {
  return new AppError("not_found", `${what} not found.`);
}
