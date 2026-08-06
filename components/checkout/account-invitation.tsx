import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * The account invitation, shown once the order is safely placed.
 *
 * **After, never during.** Registration is not a step in checkout — a shopper
 * who has to create an account before we ring them has already gone elsewhere
 * (ADR-63). The order exists before this card renders, so declining it costs
 * nothing and the two buttons are genuinely equal.
 *
 * "Maybe later" is not a lesser option dressed as one: the claim token lives in
 * a cookie for thirty days and is picked up on any later sign-in, so somebody
 * who continues shopping today and registers next week still gets this order in
 * their history.
 *
 * A Server Component — six benefits and two links need no JavaScript.
 */
const BENEFITS = [
  "orderHistory",
  "trackOrders",
  "savedDetails",
  "fasterCheckout",
  "wishlist",
  "reviews",
] as const;

export function AccountInvitation({ reference }: { reference: string | null }) {
  const t = useTranslations("checkout.invitation");

  return (
    <section
      aria-labelledby="account-invitation"
      className="space-y-5 rounded-xl border bg-muted/40 p-5 sm:p-6"
    >
      <div className="space-y-2">
        <h2
          id="account-invitation"
          className="font-semibold tracking-tight text-balance"
        >
          {t("title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{t("body")}</p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex min-w-0 items-start gap-2 text-sm">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-pretty">{t(`benefits.${benefit}`)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="sm:flex-1">
          {/*
            `from=order` tells the sign-up page to pre-fill from the order this
            browser just placed. The reference travels for display only — the
            pre-fill is resolved server-side from the claim token in the cookie,
            never from anything in this URL.
          */}
          <Link
            href={`${routes.auth.signUp}?from=order${reference ? `&ref=${encodeURIComponent(reference)}` : ""}`}
          >
            {t("createAccount")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="sm:flex-1">
          <Link href={routes.catalog.index}>{t("maybeLater")}</Link>
        </Button>
      </div>
    </section>
  );
}
