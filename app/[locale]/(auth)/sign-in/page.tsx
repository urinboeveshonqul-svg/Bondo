import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams, PageSearchParams } from "@/types";
import { redirectIfSignedIn } from "@/lib/auth/guards";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signIn" });

  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates(locale as Locale, routes.auth.signIn),
    // An authentication form has nothing a search engine should index, and a
    // sign-in page ranking above the storefront is a real outcome.
    robots: { index: false, follow: true },
  };
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Someone already signed in has no business on this form: send them where
  // they were going. Doing it here rather than in middleware keeps the Edge
  // free of a second Supabase round trip on a public route (ADR-11, ADR-14).
  const resolved = await searchParams;
  const redirectTo =
    typeof resolved.redirectTo === "string" ? resolved.redirectTo : undefined;

  await redirectIfSignedIn(redirectTo);

  const t = await getTranslations("auth.signIn");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={t.rich("noAccount", {
        link: (chunks) => (
          <Link
            href={
              redirectTo
                ? `${routes.auth.signUp}?redirectTo=${encodeURIComponent(redirectTo)}`
                : routes.auth.signUp
            }
            className="font-medium text-foreground underline underline-offset-4"
          >
            {chunks}
          </Link>
        ),
      })}
    >
      <SignInForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
