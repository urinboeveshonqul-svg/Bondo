import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { Link } from "@/i18n/navigation";
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
  const t = await getTranslations({ locale, namespace: "auth.forgotPassword" });

  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: localeAlternates(locale as Locale, routes.auth.forgotPassword),
    robots: { index: false, follow: true },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth.forgotPassword");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={t.rich("backToSignIn", {
        link: (chunks) => (
          <Link
            href={routes.auth.signIn}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {chunks}
          </Link>
        ),
      })}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
