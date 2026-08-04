import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { FormError, FormSuccess } from "@/components/auth/form-primitives";
import { ResendVerificationForm } from "@/components/auth/password-forms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/metadata";
import { currentSession } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams, PageSearchParams } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail" });

  return {
    title: t("title"),
    alternates: localeAlternates(locale as Locale, routes.auth.verifyEmail),
    robots: { index: false, follow: false },
  };
}

/**
 * One page, four arrivals:
 *
 *  - **just registered** (`?sent=1`) — "check your inbox", with resend;
 *  - **tried to sign in unverified** — the same, address pre-filled;
 *  - **clicked an expired or invalid link** (`?reason=`) — say which, offer
 *    another;
 *  - **already verified** — congratulate and get out of the way.
 *
 * One page rather than four because the useful content is identical and the
 * difference is a sentence. Four pages would be four places to forget the
 * resend button.
 */
export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: PageParams<{ locale: string }>;
  searchParams: PageSearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const resolved = await searchParams;
  const emailParam =
    typeof resolved.email === "string" ? resolved.email : undefined;
  const reason =
    typeof resolved.reason === "string" ? resolved.reason : undefined;
  const justSent = resolved.sent === "1";

  const t = await getTranslations("auth.verifyEmail");
  const session = await currentSession();

  // The happy ending: the link worked and the callback signed them in.
  if (session?.isVerified) {
    return (
      <AuthShell title={t("verifiedTitle")}>
        <div className="space-y-4 text-center">
          <MailCheck
            className="mx-auto size-10 text-success"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">{t("verifiedBody")}</p>
          <Button asChild className="w-full">
            <Link href={routes.account.index}>{t("continue")}</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const email = emailParam ?? session?.user.email ?? undefined;

  return (
    <AuthShell title={t("title")} description={t("subtitle")}>
      <div className="space-y-5">
        {reason ? (
          <FormError
            message={reason === "expired" ? t("expired") : t("invalid")}
          />
        ) : null}

        {justSent ? <FormSuccess message={t("sent")} /> : null}

        <p className="text-sm text-muted-foreground">{t("body")}</p>

        <ResendVerificationForm defaultEmail={email} />

        <p className="text-center text-sm text-muted-foreground">
          {t.rich("backToSignIn", {
            link: (chunks) => (
              <Link
                href={routes.auth.signIn}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </AuthShell>
  );
}
