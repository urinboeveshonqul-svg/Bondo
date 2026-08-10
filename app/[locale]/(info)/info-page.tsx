import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ContentPageLayout } from "@/components/content/content-page-layout";
import { CatalogUnavailable } from "@/components/shared/catalog-unavailable";
import { localeAlternates } from "@/i18n/metadata";
import { pick } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import { getInfoPage, readCatalog } from "@/services/catalog.reads";

/**
 * The two halves every business-information route needs.
 *
 * Five routes exist as their own folders rather than as one dynamic `[page]`
 * segment, and that is deliberate: a dynamic segment at the top level would sit
 * beside `app/[locale]/[...rest]`, the catch-all that produces the localized
 * 404, and the two would compete for every unknown URL on the site. ADR-42
 * records how fragile that path already is. Five static folders cost five
 * eight-line files and cannot shadow anything.
 *
 * What they share lives here, so the pages differ only in their key.
 */

/** Metadata from the page's own row — title and description in the reader's language. */
export async function infoPageMetadata(
  key: string,
  locale: string,
  path: string,
): Promise<Metadata> {
  const activeLocale = locale as Locale;
  const page = await readCatalog(() => getInfoPage(key));

  // A page that cannot be read still needs *some* metadata, and inventing a
  // title for it would be worse than letting the layout's template supply one.
  if (!page) return { alternates: localeAlternates(activeLocale, path) };

  const title =
    pick(page.seoTitle, activeLocale) || pick(page.title, activeLocale);
  const description =
    pick(page.seoDescription, activeLocale) || pick(page.excerpt, activeLocale);

  return {
    title,
    ...(description ? { description } : {}),
    alternates: localeAlternates(activeLocale, path),
    openGraph: { title, ...(description ? { description } : {}) },
  };
}

/** The rendered page. `aside` lets the contact route swap in its details card. */
export async function InfoPage({
  pageKey,
  locale,
  aside,
}: {
  pageKey: string;
  locale: string;
  aside?: React.ReactNode;
}) {
  setRequestLocale(locale);

  const activeLocale = locale as Locale;

  // Wrapped, because a throw here aborts the shell rather than reaching
  // `app/[locale]/error.tsx` (**K-19**). `null` means the page could not be
  // read — including "the migration has not been applied", which is the one
  // failure mode worth noticing rather than papering over.
  const page = await readCatalog(() => getInfoPage(pageKey));

  if (!page) return <CatalogUnavailable />;

  return (
    <ContentPageLayout
      title={pick(page.title, activeLocale)}
      excerpt={pick(page.excerpt, activeLocale)}
      body={pick(page.body, activeLocale)}
      aside={aside}
    />
  );
}
