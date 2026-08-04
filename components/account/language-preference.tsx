import { getLocale, getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { localeConfig, type Locale } from "@/lib/site-config";

/**
 * Language, on the profile page.
 *
 * It reuses the header's `LanguageSwitcher` rather than adding a second control
 * with its own persistence. There is one writer of `NEXT_LOCALE` — the
 * middleware — and a "preferred language" select that wrote a database column
 * would immediately disagree with the URL a visitor is actually reading.
 *
 * So this is the honest framing: it shows the language *in use* and offers the
 * same switcher, rather than implying a stored account preference that does not
 * exist. A per-user column would only be worth adding when something sends mail
 * — a transactional email has no URL to take its locale from, and that arrives
 * with Phase 8 (**D-24**).
 */
export async function LanguagePreference() {
  const t = await getTranslations("account.language");
  const locale = (await getLocale()) as Locale;

  return (
    <section
      aria-labelledby="account-language"
      className="rounded-xl border bg-card p-5 sm:p-6"
    >
      <div className="mb-4 space-y-1">
        <h2 id="account-language" className="font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-muted-foreground">{t("current")}: </span>
          <span lang={locale} className="font-medium">
            {localeConfig[locale].label}
          </span>
        </p>

        <LanguageSwitcher />
      </div>
    </section>
  );
}
