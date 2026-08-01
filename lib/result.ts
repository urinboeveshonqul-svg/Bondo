/**
 * Discriminated result used at every trust boundary — Server Actions and Route
 * Handlers. Returning a result instead of throwing forces the caller to handle
 * the failure path, and keeps a thrown exception meaning "unexpected".
 *
 * This lives in `lib/` rather than `types/` because `ok()` and `err()` are
 * runtime values; `types/` contains only declarations that compile away.
 */

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E>(
  error: E,
  fieldErrors?: Record<string, string[]>,
): Result<never, E> {
  return { ok: false, error, fieldErrors };
}
