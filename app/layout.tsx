import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";

import { localeConfig, type Locale } from "@/lib/site-config";
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
 * The document root.
 *
 * This was a passthrough until ADR-82, with `<html>` and `<body>` in
 * `app/[locale]/layout.tsx` because that is the first element that knows the
 * language. The reasoning was sound and it cost us every 404 on the site
 * (**K-20**): Next.js renders `not-found.tsx` inside the **root** layout and no
 * layout below it, so with nothing here to render into, Next substituted its own
 * bare shell — `<html id="__next_error__">`, no `lang`, no font. The localized
 * copy rendered correctly inside a document that looked like a crash.
 *
 * The locale cannot come from a route param here, because this sits above
 * `[locale]`. It comes from `getLocale()`, which reads next-intl's per-request
 * config — and that resolver falls back to the default locale rather than
 * throwing when there is no `[locale]` segment, which is exactly the 404 case.
 * `cookies()` or `headers()` would throw during that render instead, and put the
 * fallback document straight back.
 *
 * Only the document lives here. The providers, header and footer stay in the
 * locale layout, because a 404 must not depend on the category query (**K-18**).
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = (await getLocale()) as Locale;

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
      <body className="flex min-h-svh flex-col antialiased">{children}</body>
    </html>
  );
}
