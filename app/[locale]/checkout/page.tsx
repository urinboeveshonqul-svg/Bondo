import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { Container } from "@/components/layout/container";
import { localeAlternates } from "@/i18n/metadata";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates(locale as Locale, routes.checkout),
    // A checkout has nothing a search engine should index and everything a
    // shopper would rather was not in a crawl.
    robots: { index: false, follow: false },
  };
}

/**
 * Checkout.
 *
 * A Server Component wrapping one client form: the shell, the heading and the
 * metadata cost no JavaScript, and only the part that has to hold state does.
 *
 * **No sign-in gate.** `/checkout` is in `protectedRoutePrefixes` for the
 * *account* flows that live under it, and guest checkout is the primary path
 * (ADR-63) — so this page is deliberately reachable by anybody. The order needs
 * a phone number, not an account.
 */
export default async function CheckoutPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("checkout");

  return (
    <Container className="py-8 sm:py-12">
      <div className="mb-8 max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-pretty text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CheckoutForm />
    </Container>
  );
}
