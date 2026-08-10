import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import { ContentBody } from "@/components/content/content-body";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * The shell every business-information page renders inside.
 *
 * One layout for delivery, warranty, returns, contact and about, so the five
 * pages cannot drift into five different shapes — the same reasoning `Section`
 * applies to the landing page and `ModuleForm` applies to the admin.
 *
 * ## Width
 *
 * Capped at 1120px rather than the site's 1280px `Container`. These pages are
 * prose, and prose set across the full catalog width is a line too long to track
 * back to the start of. The body column inside it is narrower again.
 *
 * ## The aside is not decoration
 *
 * Every one of these pages ends by telling the reader to get in touch — the
 * returns policy is not finalised, the warranty's detailed terms are not
 * published, and delivery cost is quoted on a call. A card carrying that link,
 * beside the copy rather than under it, is the one piece of furniture these
 * pages actually need. On a phone it drops below the text, where it reads as the
 * conclusion it is.
 *
 * A Server Component with no interactivity, so these pages ship no JavaScript of
 * their own.
 */
export function ContentPageLayout({
  title,
  excerpt,
  body,
  aside,
}: {
  title: string;
  excerpt?: string;
  body: string;
  /** Replaces the default "get in touch" card — the contact page brings its own. */
  aside?: React.ReactNode;
}) {
  const t = useTranslations("info");

  return (
    <Container className="max-w-[1120px] py-10 sm:py-12">
      <header className="mb-8 max-w-2xl space-y-2">
        {/*
          `text-3xl`, not the catalog's `text-4xl`. An information page is read,
          not scanned, and an oversized heading on a short page is most of what
          makes one look like a template.
        */}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        {excerpt ? (
          <p className="text-pretty text-muted-foreground">{excerpt}</p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
        <div className="max-w-2xl">
          <ContentBody body={body} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {aside ?? (
            <div className="rounded-xl border bg-muted/40 p-5">
              <h2 className="text-sm font-semibold tracking-tight">
                {t("help.title")}
              </h2>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                {t("help.body")}
              </p>
              <Link
                href={routes.info.contact}
                className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t("help.cta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}
