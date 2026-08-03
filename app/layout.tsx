import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/site-config";
import "@/styles/globals.css";

/**
 * `next/font` self-hosts the font files at build time: no runtime request to
 * Google, no third-party origin in the critical path, and no layout shift.
 *
 * Only the `latin` subset is loaded. Adding subsets adds files to the critical
 * path, so widen this when the storefront actually ships another script.
 */
const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  /**
   * Resolves relative URLs in Open Graph and canonical tags. Without it Next.js
   * falls back to localhost and warns on every build.
   *
   * No `alternates.canonical` here on purpose: a canonical set in the root
   * layout is inherited by every page that does not override it, which would
   * tell crawlers that the whole catalog is a duplicate of one URL. Canonicals
   * belong on individual pages.
   */
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${siteConfig.name} — ${siteConfig.shortDescription}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: env.NEXT_PUBLIC_SITE_URL,
    title: siteConfig.name,
    description: siteConfig.description,
    locale: siteConfig.locale.replace("-", "_"),
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      lang={siteConfig.locale}
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-svh flex-col antialiased">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only rounded-md bg-background px-4 py-2 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>

          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
