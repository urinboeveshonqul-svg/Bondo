import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { isAppError, toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { err, ok, type Result } from "@/lib/result";

/**
 * Wrapper for Server Actions.
 *
 * A Server Action is a public HTTP endpoint — anyone can POST to it, so its
 * input must be validated server-side no matter what the form did. This helper
 * makes that non-optional: every action declares a schema, gets typed input,
 * and returns a `Result` instead of throwing across the network boundary.
 *
 *   export const createReview = createAction(
 *     "createReview",
 *     z.object({ productId: z.uuid(), rating: z.number().int().min(1).max(5) }),
 *     async (input) => reviewService.create(input),
 *   );
 *
 * The action's name is required rather than optional: it is the only handle an
 * on-call engineer has when this shows up in a log.
 */
export function createAction<TInput, TOutput>(
  name: string,
  schema: z.ZodType<TInput>,
  handler: (input: TInput) => Promise<TOutput>,
) {
  return async (rawInput: unknown): Promise<Result<TOutput>> => {
    const parsed = schema.safeParse(rawInput);

    if (!parsed.success) {
      // Grouped by field path so a form can render each message next to its
      // input. Issues with an empty path are form-level.
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "form";
        (fieldErrors[field] ??= []).push(issue.message);
      }

      return err("Please check the highlighted fields.", fieldErrors);
    }

    try {
      return ok(await handler(parsed.data));
    } catch (error) {
      // `redirect()` and `notFound()` signal themselves by throwing. Catching
      // those would silently turn a redirect into an error message, so they are
      // rethrown before anything else looks at the value.
      unstable_rethrow(error);

      // Expected failures are logged as warnings; anything else is a bug and
      // gets a full error entry with the stack.
      if (isAppError(error)) {
        logger.warn(`action:${name} failed`, { code: error.code });
      } else {
        logger.error(`action:${name} threw`, error);
      }

      return err(toUserMessage(error));
    }
  };
}

/**
 * Converts a `FormData` payload into a plain object for schema parsing.
 *
 * A field that appears once becomes a scalar and a field that repeats becomes
 * an array — which is how HTML forms behave, not a choice made here. A schema
 * for a field that may legitimately have one or many values (checkbox groups,
 * multi-selects) should wrap it so both shapes parse.
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    const existing = result[key];

    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}
