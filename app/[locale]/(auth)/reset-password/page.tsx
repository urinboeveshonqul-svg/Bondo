import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { FormError } from "@/components/auth/form-primitives";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { currentSession } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" });

  return {
    title: t("title"),
    alternates: localeAlternates(locale as Locale, routes.auth.resetPassword),
    robots: { index: false, follow: false },
  };
}

/**
 * Reached from the recovery email, via `/auth/callback`, which has already
 * exchanged the code for a session by the time this renders.
 *
 * **The absence of that session is the expired-link case**, and it is the
 * common one — recovery links are single-use and time-limited, and people click
 * them twice. So a missing session is explained here with a way forward rather
 * than rendering a password form that will refuse on submit.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth.resetPassword");
  const session = await currentSession();

  if (!session) {
    return (
      <AuthShell title={t("title")}>
        <div className="space-y-4">
          <FormError message={t("linkExpired")} />
          <p className="text-sm text-muted-foreground">
            {t("linkExpiredHint")}
          </p>
          <Button asChild className="w-full">
            <Link href={routes.auth.forgotPassword}>{t("requestNew")}</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("title")} description={t("subtitle")}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
