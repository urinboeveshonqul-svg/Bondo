import "server-only";

import { can, type Permission } from "@/lib/admin/permissions";
import { AppError } from "@/lib/errors";
import { createClient } from "@/supabase/server";
import * as authService from "@/services/auth.service";
import { authorizationFor } from "@/services/authorization.service";

/**
 * The capability check a **Server Action** performs.
 *
 * Separate from `guardModule` in `components/admin/module/`, and the difference
 * is the failure mode rather than the logic. That one calls `notFound()`, which
 * is right for a page — an administrator who types a URL they may not open
 * should see the same thing as somebody who typed a URL that does not exist.
 * Rendering a 404 in response to a form submission is not right: the form is
 * still on screen, and the person who pressed Save is owed a sentence.
 *
 * So this throws an `AppError`, which `createAction()` turns into a
 * `Result.error` the form can display.
 *
 * **Neither is the boundary.** RLS refuses the write through `has_permission()`
 * regardless (ADR-4). This exists so a refusal arrives as a message rather than
 * as a Postgres error code, and so an action that is called by something other
 * than its own form still stops.
 *
 * It takes a **permission**, not a module id, unlike its page-level counterpart.
 * An action is not a screen: `placeOrder` has no module, and an action that
 * outlives or precedes its module — as the order actions currently do — should
 * not be unable to authorise itself for want of a registry entry.
 */
export async function requirePermission(
  required: Permission | readonly Permission[],
): Promise<{ userId: string }> {
  const supabase = await createClient();
  const user = await authService.currentUser(supabase);

  if (!user) {
    throw new AppError("unauthorized", "Please sign in and try again.");
  }

  const authorization = await authorizationFor(supabase, user.id);

  // Deliberately the same message for "not staff" and "staff without this
  // permission". An operator who is told *which* permission they lack learns
  // the shape of the permission model; one who is told to ask an administrator
  // learns what to do next.
  if (!authorization.isAdmin || !can(authorization.permissions, required)) {
    throw new AppError(
      "forbidden",
      "Your account does not have access to this.",
    );
  }

  return { userId: user.id };
}
