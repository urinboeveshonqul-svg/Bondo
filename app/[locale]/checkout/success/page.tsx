import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Clock, PhoneCall } from "lucide-react";

import { AccountInvitation } from "@/components/checkout/account-invitation";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { readClaimTokens } from "@/lib/orders/claim-cookie";
import { routes } from "@/lib/routes";
import { createClient } from "@/supabase/server";
import * as authService from "@/services/auth.service";
import type { PageParams, PageSearchParams } from "@/types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Order confirmation.
 *
 * **Renders from the query string and fetches nothing.** That is forced by the
 * schema rather than chosen for speed: most orders are placed by guests, and a
 * guest holds no read privilege on `orders` at all, so there is no order for
 * this page to load. The action returns the reference; this page shows it.
 *
 * The account invitation appears only when there is something to gain by
 * accepting it — a guest with a pending claim token. A signed-in customer
 * already owns the order, and showing them a "create an account" card would be
 * both useless and slightly alarming.
 */
export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { ref } = await searchParams;
  const reference = typeof ref === "string" ? ref : null;

  const t = await getTranslations("checkout.success");

  // Two independent questions: is anybody signed in, and is a guest order
  // waiting to be claimed. Both are answered server-side; the claim token itself
  // never reaches the browser (ADR-70).
  const supabase = await createClient();
  const user = await authService.currentUser(supabase);
  const pendingClaims = user ? [] : await readClaimTokens();

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-4 text-center">
          <span className="inline-flex rounded-full bg-primary/10 p-3 text-primary">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>

          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {t("title")}
          </h1>

          {reference ? (
            <p className="text-sm text-muted-foreground">
              {t("reference")}{" "}
              <span className="font-mono font-medium text-foreground">
                {reference}
              </span>
            </p>
          ) : null}
        </div>

        <ul className="space-y-3 rounded-xl border bg-card p-5 sm:p-6">
          <li className="flex min-w-0 items-start gap-3">
            <PhoneCall
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-sm text-pretty">{t("willContact")}</span>
          </li>
          <li className="flex min-w-0 items-start gap-3">
            <Clock
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="text-sm text-pretty">{t("buildTime")}</span>
          </li>
        </ul>

        {pendingClaims.length > 0 ? (
          <AccountInvitation reference={reference} />
        ) : (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={routes.catalog.index}>{t("continueShopping")}</Link>
            </Button>
          </div>
        )}
      </div>
    </Container>
  );
}
