import { getTranslations, setRequestLocale } from "next-intl/server";
import { MailWarning, ShieldCheck } from "lucide-react";

import { SignOutButton } from "@/components/account/sign-out-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { currentSession } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import { localeConfig, type Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import type { PageParams } from "@/types";
import { formatDate } from "@/utils/format";

/**
 * Account overview.
 *
 * Deliberately not a dashboard of numbers: there are no orders yet, and a panel
 * of zeroes reads as a broken page rather than a new account. It shows who is
 * signed in, whether the address is verified, what language the interface is in,
 * and the two places to go next.
 *
 * The avatar is a **monogram**, not a placeholder image. Storage is wired but no
 * upload flow exists (D-12), and a grey silhouette implies a feature that is not
 * there. Initials are honest and, on a real account, better.
 */
export default async function AccountPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const activeLocale = locale as Locale;
  const t = await getTranslations("account.overview");
  const session = await currentSession();

  // The layout guard already redirected an anonymous visitor; this is the type
  // narrowing, not a second gate.
  if (!session) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, created_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const name = profile?.full_name?.trim() || session.user.email || "";
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <div className="space-y-6">
      {!session.isVerified ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3">
          <MailWarning
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t("unverified")}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link
              href={`${routes.auth.verifyEmail}?email=${encodeURIComponent(session.user.email ?? "")}`}
            >
              {t("verifyNow")}
            </Link>
          </Button>
        </div>
      ) : null}

      <section
        aria-labelledby="account-identity"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <h2 id="account-identity" className="sr-only">
          {t("identity")}
        </h2>

        <div className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
          >
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {session.user.email}
            </p>
          </div>

          {session.isVerified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t("verified")}
            </span>
          ) : null}
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("language")}</dt>
            <dd className="text-sm" lang={activeLocale}>
              {localeConfig[activeLocale].label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("memberSince")}
            </dt>
            <dd className="text-sm">
              {formatDate(
                profile?.created_at ?? session.user.created_at,
                activeLocale,
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={routes.account.profile}>{t("editProfile")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.account.security}>{t("security")}</Link>
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}
