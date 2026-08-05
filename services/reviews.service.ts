import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/errors";
import { toAppError } from "@/lib/supabase-error";
import type { Database, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

export type ProductReview = Tables<"product_reviews"> & {
  author: { full_name: string | null } | null;
};

export type ReviewSummary = {
  /** Mean rating to one decimal, or `null` when nothing has been reviewed. */
  average: number | null;
  count: number;
  /** Reviews at each star level, 1–5, for the distribution bars. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Every review of a product, newest first.
 *
 * Public: the RLS policy lets anonymous visitors read reviews of any published
 * product, which is what makes them useful to somebody deciding whether to buy.
 */
export async function listProductReviews(
  supabase: Client,
  productId: string,
): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select(`*, author:profiles ( full_name )`)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw toAppError(error, "load the reviews");

  return (data ?? []) as unknown as ProductReview[];
}

/**
 * The rating summary for a product.
 *
 * Computed from the rows rather than stored on `products`. A denormalised
 * average is a second copy of a number that has to be kept in step with every
 * insert, update and delete — the mistake ADR-24 already names for stock — and
 * the review count per product here is in the tens, not the millions. When it is
 * not, this becomes a materialised view and the call site does not change.
 */
export async function getReviewSummary(
  supabase: Client,
  productId: string,
): Promise<ReviewSummary> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("rating")
    .eq("product_id", productId);

  if (error) throw toAppError(error, "load the ratings");

  const ratings = (data ?? []).map((row) => row.rating);
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const rating of ratings) {
    distribution[rating as 1 | 2 | 3 | 4 | 5] += 1;
  }

  return {
    average:
      ratings.length === 0
        ? null
        : Math.round(
            (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10,
          ) / 10,
    count: ratings.length,
    distribution,
  };
}

export type ReviewableItem = {
  productId: string;
  productName: string;
  orderId: string;
  orderReference: string;
  deliveredAt: string;
};

/**
 * What this customer is entitled to review and has not yet.
 *
 * The same rule the RLS policy enforces, asked in the other direction: the
 * policy answers "may this insert happen", this answers "what should we offer".
 * Both derive from the same three facts — the order is theirs, it reached
 * `delivered`, and it contained the product — so the interface never shows a
 * form the database would refuse.
 *
 * RLS scopes both queries to the caller, so a userId is not passed in: asking
 * the database "which of *my* orders" is one fewer parameter to get wrong.
 */
export async function listReviewableProducts(
  supabase: Client,
): Promise<ReviewableItem[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, reference, updated_at,
       items:order_items ( product_id, product_name )`,
    )
    .eq("status", "delivered")
    .order("updated_at", { ascending: false });

  if (error) throw toAppError(error, "load what you can review");

  const { data: existing, error: existingError } = await supabase
    .from("product_reviews")
    .select("product_id");

  if (existingError) throw toAppError(existingError, "load your reviews");

  const reviewed = new Set((existing ?? []).map((row) => row.product_id));
  const seen = new Set<string>();
  const reviewable: ReviewableItem[] = [];

  for (const order of data ?? []) {
    const row = order as unknown as {
      id: string;
      reference: string;
      updated_at: string;
      items: { product_id: string | null; product_name: string }[];
    };

    for (const item of row.items) {
      // A deleted product cannot be reviewed: the row it would point at is gone.
      if (!item.product_id) continue;
      if (reviewed.has(item.product_id) || seen.has(item.product_id)) continue;

      seen.add(item.product_id);
      reviewable.push({
        productId: item.product_id,
        productName: item.product_name,
        orderId: row.id,
        orderReference: row.reference,
        deliveredAt: row.updated_at,
      });
    }
  }

  return reviewable;
}

/**
 * Whether this customer may review this product right now.
 *
 * Used to decide whether the product page shows a review form at all. It is a
 * convenience, never the gate: the gate is the RLS policy, which the insert
 * meets or does not regardless of what this returned (ADR-66).
 */
export async function canReviewProduct(
  supabase: Client,
  productId: string,
): Promise<{ allowed: boolean; orderId: string | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select(`id, items:order_items!inner ( product_id )`)
    .eq("status", "delivered")
    .eq("order_items.product_id", productId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) throw toAppError(error, "check whether you can review this");

  const order = data?.[0];
  if (!order) return { allowed: false, orderId: null };

  const { count, error: countError } = await supabase
    .from("product_reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if (countError) throw toAppError(countError, "check your reviews");

  return { allowed: (count ?? 0) === 0, orderId: order.id };
}

export type CreateReviewInput = {
  productId: string;
  orderId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
};

/**
 * Writes a review.
 *
 * Every rule the brief states — verified buyer, delivered order, one per
 * purchased product — is enforced by the policy this insert has to satisfy, not
 * by a check here. A refusal therefore comes back as an RLS error, and it is
 * translated into something a shopper can read rather than surfaced raw.
 */
export async function createReview(
  supabase: Client,
  input: CreateReviewInput,
): Promise<Tables<"product_reviews">> {
  const { data, error } = await supabase
    .from("product_reviews")
    .insert({
      product_id: input.productId,
      order_id: input.orderId,
      user_id: input.userId,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
    })
    .select()
    .single();

  if (error) {
    // 23505 — the (user_id, product_id) unique index. The customer already
    // reviewed this, which is a sentence they can act on.
    if (error.code === "23505") {
      throw new AppError("conflict", "You have already reviewed this product.");
    }

    // 42501 — the policy refused. Either the order is not theirs, or it has not
    // been delivered, or it did not contain this product. The message does not
    // say which: telling an anonymous caller *why* an authorisation check failed
    // is how a probe learns the shape of somebody else's order.
    if (error.code === "42501") {
      throw new AppError(
        "forbidden",
        "Reviews are open once your order has been delivered.",
      );
    }

    throw toAppError(error, "publish your review");
  }

  return data;
}

/** Removes the caller's own review. RLS refuses anybody else's. */
export async function deleteReview(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", id);

  if (error) throw toAppError(error, "remove your review");
}
