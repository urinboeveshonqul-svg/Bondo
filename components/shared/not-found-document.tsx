import { Geist, Geist_Mono } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";

import { localeConfig, type Locale } from "@/lib/site-config";

/**
 * The 404 page's content, without the document around it.
 *
 * Two constraints shape it, and both come from the fact that Next.js applies no
 * storefront layout to a 404 (**K-20**, ADR-82):
 *
 * - **No providers.** `NextIntlClientProvider` and the theme context live in
 *   `app/[locale]/layout.tsx`, which does not render here. Links are plain `<a>`
 *   elements; `Link` from `@/i18n/navigation` reads the locale from that
 *   provider and would throw. This is the one place CLAUDE.md § 11's rule
 *   cannot apply, because there is no provider to read from.
 * - **No queries.** The header and footer both need the category tree, and a
 *   404 that depends on a database read is a 404 that can fail (**K-18**). It
 *   offers the way home and asks nothing of Supabase.
 *
 * The locale comes from `getLocale()`, which resolves through `i18n/request.ts`
 * and falls back to the default locale instead of throwing when there is no
 * `[locale]` segment to read — the case for a URL that matched nothing at all.
 */
export async function NotFoundContent() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "errors.notFound" });

  return (
    // A `<div>` and not a `<main>`. When `notFound()` comes from a route that
    // matched, this renders inside the locale layout's `<main id="main">`, and
    // two nested `<main>` elements are invalid — a screen reader offers the
    // visitor a choice of landmarks where there is one region. `NotFoundDocument`
    // supplies the landmark for the case where no layout renders at all.
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-6 px-4 py-24 sm:px-6 sm:py-32">
      <p className="font-mono text-sm text-muted-foreground">{t("code")}</p>

      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {t("title")}
      </h1>

      <p className="max-w-md text-pretty text-muted-foreground">
        {t("description")}
      </p>

      <a
        href={`/${locale}`}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("backHome")}
      </a>
    </div>
  );
}

/**
 * `next/font` is declared here as well as in `app/layout.tsx` because
 * `global-not-found.tsx` renders with no layout at all — not even the root one.
 * The two declarations resolve to the same self-hosted files, so this costs a
 * duplicate CSS variable definition and no extra download.
 */
const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

/**
 * The 404 as a complete document, `<html>` downwards.
 *
 * Only `app/global-not-found.tsx` needs this: a URL that matched no route gets
 * no layout whatsoever, so the page has to draw its own document. A
 * `notFound()` from a route that *did* match renders inside `app/layout.tsx`,
 * which supplies the document — that path uses `NotFoundContent` alone.
 */
export async function NotFoundDocument() {
  const locale = (await getLocale()) as Locale;

  return (
    <html
      lang={localeConfig[locale].tag}
      dir="ltr"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-svh flex-col antialiased">
        <main className="flex flex-1 flex-col">
          <NotFoundContent />
        </main>
      </body>
    </html>
  );
}
