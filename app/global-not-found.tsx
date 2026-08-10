import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { NotFoundDocument } from "@/components/shared/not-found-document";
import { siteConfig, type Locale } from "@/lib/site-config";
// Imported here as well as in `app/layout.tsx`: this route renders with no
// layout at all, so nothing else pulls the stylesheet in.
import "@/styles/globals.css";

/**
 * The 404 for a URL that matched no route at all.
 *
 * Enabled by `experimental.globalNotFound` in `next.config.ts`, which is what
 * allows a 404 to render its own `<html>` — see `NotFoundDocument` for why it
 * has to. `app/[locale]/not-found.tsx` handles the other half: `notFound()`
 * raised by a route that *did* match.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "errors.notFound" });

  return {
    title: `${t("title")} — ${siteConfig.name}`,
    // An indexed 404 is a 404 that turns up in search results.
    robots: { index: false, follow: true },
  };
}

export default function GlobalNotFound() {
  return <NotFoundDocument />;
}
