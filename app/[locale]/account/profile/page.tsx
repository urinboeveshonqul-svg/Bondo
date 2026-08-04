import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProfileForm } from "@/components/account/profile-form";
import { LanguagePreference } from "@/components/account/language-preference";
import { currentSession } from "@/lib/auth/guards";
import { createClient } from "@/supabase/server";
import type { PageParams } from "@/types";

export default async function AccountProfilePage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("account.profile");
  const session = await currentSession();
  if (!session) return null;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", session.user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="profile-details"
        className="rounded-xl border bg-card p-5 sm:p-6"
      >
        <div className="mb-5 space-y-1">
          <h2 id="profile-details" className="font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Read-only, and the form says why rather than leaving it a mystery
            (D-23). */}
        <div className="mb-5 space-y-1.5">
          <p className="text-sm font-medium">{t("email")}</p>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
          <p className="text-xs text-muted-foreground">{t("emailLocked")}</p>
        </div>

        <ProfileForm
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone ?? ""}
        />
      </section>

      <LanguagePreference />
    </div>
  );
}
