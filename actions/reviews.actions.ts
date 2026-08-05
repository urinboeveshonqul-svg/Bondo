"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { AppError } from "@/lib/errors";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as authService from "@/services/auth.service";
import * as reviewsService from "@/services/reviews.service";

/**
 * Review entry points.
 *
 * The rule the brief states — a review only from a verified buyer, only after
 * the order reached `delivered`, only once per purchased product — is **not**
 * implemented here. It is an RLS policy, and this action's job is to carry the
 * refusal back as a sentence rather than to be the thing that refuses (ADR-66).
 *
 * That split matters because this file is the easy one to get wrong. A check
 * written here protects the form; a policy written in the database protects the
 * table, including from the next action somebody adds in a hurry.
 */

export const submitReview = createAction(
  "submitReview",
  z.object({
    productId: z.uuid(),
    orderId: z.uuid(),
    rating: z.number().int().min(1, "reviews.errors.ratingRequired").max(5),
    title: z.string().trim().max(120).nullish(),
    body: z.string().trim().max(2000, "reviews.errors.bodyTooLong").nullish(),
    /** Which product page to refresh once the review lands. */
    productSlug: z.string().trim().min(1).max(200),
  }),
  async (input) => {
    const supabase = await createClient();
    const user = await authService.currentUser(supabase);

    // Anonymous visitors cannot have bought anything, so this is a real answer
    // rather than a guard: there is no order to attach the review to.
    if (!user) {
      throw new AppError("unauthorized", "reviews.errors.signInFirst");
    }

    const review = await reviewsService.createReview(supabase, {
      productId: input.productId,
      orderId: input.orderId,
      userId: user.id,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
    });

    for (const locale of locales) {
      revalidatePath(`/${locale}/products/${input.productSlug}`);
    }

    return { id: review.id };
  },
);

export const removeReview = createAction(
  "removeReview",
  z.object({
    id: z.uuid(),
    productSlug: z.string().trim().min(1).max(200),
  }),
  async (input) => {
    const supabase = await createClient();
    const user = await authService.currentUser(supabase);

    if (!user) {
      throw new AppError("unauthorized", "reviews.errors.signInFirst");
    }

    // No ownership check here either: the delete policy is `user_id =
    // auth.uid()`, so somebody else's review simply matches no rows.
    await reviewsService.deleteReview(supabase, input.id);

    for (const locale of locales) {
      revalidatePath(`/${locale}/products/${input.productSlug}`);
    }

    return { removed: true };
  },
);
