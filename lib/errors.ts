/**
 * Application error taxonomy.
 *
 * Services throw `AppError`; the boundary that catches it (a Server Action, a
 * Route Handler, an error boundary) decides how to present it. The `code`
 * discriminates programmatically, `message` is safe to show a user, and
 * `cause` carries the original error for logging without leaking it.
 */

export type AppErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "upstream"
  | "internal";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  rate_limited: 429,
  upstream: 502,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, string[]> },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Narrows an unknown thrown value to a message that is safe to render.
 * Unexpected errors are deliberately flattened so internal details (SQL text,
 * stack frames, provider responses) never reach the client.
 */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "Something went wrong. Please try again.";
}
