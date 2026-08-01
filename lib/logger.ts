/**
 * Minimal structured logger.
 *
 * Emits JSON in production so a log drain can parse it, and readable lines in
 * development. Swapping in a hosted logger later means changing this file only
 * — call sites stay the same.
 *
 * This module deliberately reads `process.env.NODE_ENV` directly instead of
 * importing `lib/env.ts`. It is used from Client Components (`app/error.tsx`),
 * and importing the env module would pull Zod and the whole environment schema
 * into the shared client bundle for every route.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === "production";

function write(level: LogLevel, message: string, context?: LogContext) {
  if (level === "debug" && isProduction) return;

  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  };

  const line = isProduction ? JSON.stringify(entry) : `[${level}] ${message}`;
  const payload = isProduction ? [line] : [line, context ?? ""];

  if (level === "error") console.error(...payload);
  else if (level === "warn") console.warn(...payload);
  else console.log(...payload);
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    write("debug", message, context),
  info: (message: string, context?: LogContext) =>
    write("info", message, context),
  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    write("error", message, {
      ...context,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    }),
};
