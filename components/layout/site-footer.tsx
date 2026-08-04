import { useLocale, useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { siteConfig, type Locale } from "@/lib/site-config";
import { categories } from "@/mocks/catalog";

/**
 * Site footer.
 *
 * The column headings are real `<h2>` elements inside a `<nav>` per group, so a
 * screen reader can jump between "Shop", "Support" and "Company" instead of
 * hearing one undifferentiated list of thirty links. `h2` rather than `h3`
 * because the columns sit directly under the page `h1` — the footer is a
 * top-level region, and a page whose body has no `h2` would otherwise skip a
 * level on the way down to them.
 *
 * Only links whose pages exist are rendered as links. Support, warranty and
 * company pages arrive with the content phase; until then they are listed as
 * plain text with a note, because a footer full of 404s is worse than a footer
 * that is honest about what is built.
 */

/**
 * Translation keys, not labels. The order is the display order, and the strings
 * themselves live in `messages/<locale>/footer.json` — listing them here in one
 * language is exactly the hardcoding the i18n policy forbids.
 */
const SUPPORT_ITEMS = ["contact", "delivery", "warranty", "tracking"] as const;
const COMPANY_ITEMS = ["about", "buildService", "business", "careers"] as const;

/**
 * Social channels, as text rather than icons.
 *
 * lucide-react v1 removed brand glyphs, and substituting a generic icon for a
 * platform mark is the same mistake as inventing a manufacturer logo — it
 * implies a relationship that does not exist. When the accounts are real, the
 * platforms' own licensed marks go here.
 *
 * Not translated: these are product names, and "YouTube" is "YouTube" in every
 * language.
 */
const SOCIAL_CHANNELS = ["X", "YouTube", "LinkedIn", "GitHub"] as const;

export function SiteFooter() {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <p className="text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </p>
            <p className="max-w-sm text-sm text-pretty text-muted-foreground">
              {t("tagline")}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              {t("warranty")}
            </p>
          </div>

          <nav aria-labelledby="footer-shop" className="lg:col-span-2">
            <h2 id="footer-shop" className="mb-3 text-sm font-semibold">
              {t("shop")}
            </h2>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={routes.catalog.byCategory(category.slug)}
                    className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {category.name[locale]}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={routes.catalog.index}
                  className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {tCommon("allProducts")}
                </Link>
              </li>
            </ul>
          </nav>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">{t("support")}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {SUPPORT_ITEMS.map((item) => (
                <li key={item}>{t(`supportItems.${item}`)}</li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">{t("company")}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {COMPANY_ITEMS.map((item) => (
                <li key={item}>{t(`companyItems.${item}`)}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-sm font-semibold">{t("stayInTouch")}</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("newsletterNote")}
            </p>
            <NewsletterForm compact />
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {/*
              The year is passed through as a plain string rather than a number:
              a copyright year is an identifier, and `Intl` would render 2026 as
              "2,026" in English and "2 026" in Russian.
            */}
            {t("copyright", { year: String(new Date().getFullYear()) })}
          </p>

          <ul
            aria-label={t("socialLabel")}
            className="flex items-center gap-4 text-xs text-muted-foreground"
          >
            {SOCIAL_CHANNELS.map((channel) => (
              <li key={channel}>{channel}</li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/70">
          {t("pagesNote")}
        </p>
      </Container>
    </footer>
  );
}
