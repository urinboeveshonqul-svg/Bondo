import { getTranslations, setRequestLocale } from "next-intl/server";
import { MailCheck, MailWarning, ShieldCheck } from "lucide-react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { SignOutButton } from "@/components/account/sign-out-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { currentSession } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { PageParams } from "@/types";
import { formatDate } from "@/utils/format";

/**
 * Security.
 *
 * Three blocks: the password, the state of the email address, and the session.
 *
 * **"Sessions" is one session, honestly labelled.** Supabase does not expose a
 * per-device session list to an anon-key client — listing them needs the admin
 * API and the service role, which must never reach a page. So this shows the
 * current sign-in and offers "sign out everywhere", which is the capability that
 * actually matters; a fake device list would be worse than none (**D-25**).
 */
export default async function AccountSecurityPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activeLocale = locale as Locale;
  const t = await getTranslations("account.security");
  const session = await currentSession();
  if (!session) return null;

  const lastSignIn = session.user.last_sign_in_at;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="security-password"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <div className="mb-5 space-y-1">
          <h2 id="security-password" className="font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <ChangePasswordForm />
      </section>

      <section
        aria-labelledby="security-email"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <h2 id="security-email" className="mb-4 font-semibold tracking-tight">
          {t("emailTitle")}
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {session.isVerified ? (
            <MailCheck
              className="size-4 shrink-0 text-success"
              aria-hidden="true"
            />
          ) : (
            <MailWarning
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session.user.email}</p>
            <p className="text-xs text-muted-foreground">
              {session.isVerified ? t("emailVerified") : t("emailUnverified")}
            </p>
          </div>

          {!session.isVerified ? (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`${routes.auth.verifyEmail}?email=${encodeURIComponent(session.user.email ?? "")}`}
              >
                {t("verifyEmail")}
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="security-sessions"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <div className="mb-4 space-y-1">
          <h2 id="security-sessions" className="font-semibold tracking-tight">
            {t("sessionsTitle")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {t("sessionsSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          <ShieldCheck
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("thisDevice")}</p>
            <p className="text-xs text-muted-foreground">
              {lastSignIn
                ? t("signedInAt", {
                    when: formatDate(lastSignIn, activeLocale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  })
                : t("signedIn")}
            </p>
          </div>
          <SignOutButton variant="outline" />
        </div>
      </section>
    </div>
  );
}
