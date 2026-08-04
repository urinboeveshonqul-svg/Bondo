import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { localeAlternates } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { routes } from "@/lib/routes";
import { localeConfig, locales, siteConfig } from "@/lib/site-config";
import "@/styles/globals.css";

/**
 * `next/font` self-hosts the font files at build time: no runtime request to
 * Google, no third-party origin in the critical path, and no layout shift.
 *
 * `latin` and `cyrillic` are both loaded, because Russian is a supported locale
 * and a missing Cyrillic subset does not fail — it silently falls back to a
 * system font, so the Russian site would render in a different typeface from the
 * other two and nothing would report it. Uzbek is written in Latin script here
 * and needs no third subset.
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
 * Prerenders all three locales. Without this every localized page opts into
 * dynamic rendering, because `[locale]` is a dynamic segment.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({ locale, namespace: "home" });

  return {
    /**
     * Resolves relative URLs in Open Graph, canonical and `hreflang` tags.
     * Without it Next.js falls back to localhost and warns on every build.
     */
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    title: {
      default: `${siteConfig.name} — ${t("metaTitle")}`,
      template: `%s | ${siteConfig.name}`,
    },
    description: t("metaDescription"),
    applicationName: siteConfig.name,

    /**
     * The home page's canonical and language alternates. Every other route
     * overrides this with its own — a canonical inherited by the whole tree
     * would tell crawlers the entire catalog duplicates one URL (ADR-15).
     */
    alternates: localeAlternates(locale, routes.home),

    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      url: env.NEXT_PUBLIC_SITE_URL,
      title: siteConfig.name,
      description: t("metaDescription"),
      locale: localeConfig[locale].openGraph,
      // Tells a crawler the same page exists in the other two languages.
      alternateLocale: locales
        .filter((other) => other !== locale)
        .map((other) => localeConfig[other].openGraph),
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.name,
      description: t("metaDescription"),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

/**
 * The application's root layout.
 *
 * It lives under `[locale]` rather than at `app/` because it is the first
 * element that depends on the language: `<html lang>` has to be right before
 * anything renders, and a layout above this one could not know the locale.
 */
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // `[locale]` is a URL segment, so it is user input: `/de/products` arrives
  // here with "de". Without this check it would render the default locale's
  // messages under a URL claiming to be German, which is a duplicate-content
  // problem as well as a wrong answer.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this subtree back into static rendering. Omitting it makes every page
  // below dynamic the moment it reads a translation.
  setRequestLocale(locale);

  const t = await getTranslations("common");

  // The font variables belong on <html>, not <body>: globals.css applies
  // `font-sans` to the html element, so the custom property has to be defined
  // there or it resolves to nothing and the browser falls back to a serif.
  //
  // `suppressHydrationWarning` is scoped to <html> and is required by
  // next-themes: it writes the theme class from a pre-paint inline script, so
  // the server-rendered attribute legitimately differs on the first client
  // pass. It suppresses nothing below this element.
  return (
    <html
      lang={localeConfig[locale].tag}
      dir="ltr"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-svh flex-col antialiased">
        {/*
          Sends the active locale, the messages and the pinned time zone to
          Client Components. Only the messages for components actually rendered
          on the client are serialised into the payload, so the Uzbek and English
          copy is not shipped to a Russian visitor.
        */}
        <NextIntlClientProvider>
          <ThemeProvider>
            <a
              href="#main"
              className="sr-only rounded-md bg-background px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:ring-2 focus:ring-ring"
            >
              {t("skipToContent")}
            </a>

            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
