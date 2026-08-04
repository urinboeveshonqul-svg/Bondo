import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountNav } from "@/components/account/account-nav";
import { Container } from "@/components/layout/container";
import { requireUser } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { PageParams } from "@/types";

export const metadata: Metadata = {
  // Nothing under /account belongs in an index.
  robots: { index: false, follow: false },
};

/**
 * The account shell.
 *
 * The guard is here rather than in each page: every route below this one
 * requires a session, and repeating the check five times is five chances to
 * forget it once. Middleware has already redirected the anonymous case at the
 * Edge — this catches the cookie revoked between that check and this render, and
 * makes the subtree correct on its own terms.
 *
 * **A layout must not throw** (K-18/K-19). `requireUser` redirects, which is a
 * control-flow signal Next handles rather than an exception that would take the
 * whole document down.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireUser(routes.account.index);

  const t = await getTranslations("account");

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 text-pretty text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
