import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { redirectIfSignedIn } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams, PageSearchParams } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signUp" });

  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates(locale as Locale, routes.auth.signUp),
    robots: { index: false, follow: true },
  };
}

export default async function SignUpPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const resolved = await searchParams;
  const redirectTo =
    typeof resolved.redirectTo === "string" ? resolved.redirectTo : undefined;

  await redirectIfSignedIn(redirectTo);

  const t = await getTranslations("auth.signUp");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={t.rich("haveAccount", {
        link: (chunks) => (
          <Link
            href={
              redirectTo
                ? `${routes.auth.signIn}?redirectTo=${encodeURIComponent(redirectTo)}`
                : routes.auth.signIn
            }
            className="font-medium text-foreground underline underline-offset-4"
          >
            {chunks}
          </Link>
        ),
      })}
    >
      <SignUpForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
