"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star } from "lucide-react";

import { submitReview } from "@/actions/reviews.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type ReviewableLine = {
  productId: string;
  productName: string;
  productSlug: string | null;
  /** The delivered order this line came from; the policy checks the pair. */
  orderId: string;
};

/**
 * Rate what you bought, from the order it arrived on.
 *
 * ## Why it lives on the order and not only on the product page
 *
 * The product page can ask "have you bought this?", and does. But a customer
 * who wants to leave feedback starts from the thing they remember — the order —
 * and asking them to find five product pages to review five products is how
 * feedback does not get written.
 *
 * ## What is not enforced here
 *
 * Everything. This form is a convenience: the gate is the RLS policy on
 * `product_reviews` (ADR-66), which independently checks that the reviewer
 * bought this product, on an order that reached `delivered`, and has not already
 * reviewed it. A form that decided any of those itself would be a second
 * opinion that can disagree with the database.
 *
 * The list of lines is therefore the *server's* answer to what is reviewable —
 * already filtered for products this customer has reviewed — and a submission it
 * accepts and the policy refuses surfaces as an error, not as a silent no-op.
 */
export function OrderReviewPanel({ lines }: { lines: ReviewableLine[] }) {
  const t = useTranslations("account.reviews");

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("allReviewed")}</p>;
  }

  return (
    <ul className="space-y-4">
      {lines.map((line) => (
        <li key={line.productId}>
          <ReviewForm line={line} />
        </li>
      ))}
    </ul>
  );
}

function ReviewForm({ line }: { line: ReviewableLine }) {
  const t = useTranslations("account.reviews");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      toast.error(t("ratingRequired"));
      return;
    }

    startTransition(async () => {
      const result = await submitReview({
        productId: line.productId,
        // The order this line came from — `listReviewableProducts` pairs them,
        // and the policy checks the pair rather than trusting either alone.
        orderId: line.orderId,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        productSlug: line.productSlug ?? "",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t("thanks"));
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">{line.productName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("thanks")}</p>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-4"
      onSubmit={onSubmit}
    >
      <p className="text-sm font-medium text-balance">{line.productName}</p>

      <fieldset className="space-y-1.5">
        <legend className="text-xs text-muted-foreground">
          {t("ratingLabel")}
        </legend>
        {/*
          Radio inputs behind the stars, not buttons: a rating is a single
          choice from five, which is what a radio group is, and it arrives
          keyboard-operable and announced without any ARIA of our own.
        */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="cursor-pointer p-1"
              title={t("stars", { count: value })}
            >
              <input
                type="radio"
                name={`rating-${line.productId}`}
                value={value}
                checked={rating === value}
                disabled={pending}
                onChange={() => setRating(value)}
                className="peer sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                  value <= rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
              <span className="sr-only">{t("stars", { count: value })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor={`title-${line.productId}`}>{t("titleLabel")}</Label>
        <Input
          id={`title-${line.productId}`}
          value={title}
          disabled={pending}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`body-${line.productId}`}>{t("bodyLabel")}</Label>
        <Textarea
          id={`body-${line.productId}`}
          rows={3}
          value={body}
          disabled={pending}
          maxLength={2000}
          placeholder={t("bodyPlaceholder")}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
