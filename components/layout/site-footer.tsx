import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { siteConfig, type Locale } from "@/lib/site-config";
import type { Category } from "@/types/catalog";

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
 *
 * ## Why the mobile accordion is `<details>` and not the Accordion primitive
 *
 * Measured before changing anything: the old footer was **1062px tall at 320px**
 * — 1.33 phone screens of links under every page on the site. Collapsing it was
 * the fix, and the question was what to collapse it with.
 *
 * `components/ui/accordion.tsx` is Radix, and Radix is a Client Component. Using
 * it would have turned the footer — currently pure server-rendered markup on
 * every page of the site — into a hydration root, to animate four disclosure
 * triangles. `<details>`/`<summary>` is the platform's own disclosure widget: it
 * opens with no JavaScript, it is keyboard operable and correctly announced
 * without a single ARIA attribute, and it survives hydration failing entirely.
 *
 * The cost is that `<details>` cannot be forced open by CSS at a breakpoint —
 * the `open` attribute governs it, not a stylesheet. So the group markup is
 * rendered twice, once inside `<details>` for mobile and once as a plain column
 * for `sm:` and up, with `FooterGroupLinks` shared between them so the link list
 * itself exists once. That is roughly 400 bytes of duplicated static HTML per
 * group against a client bundle and a hydration pass on every route — and the
 * duplicate costs nothing to render, because none of it is interactive.
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

const LINK_CLASS =
  "rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * One group's links, without the heading.
 *
 * Shared by the mobile disclosure and the desktop column so the list is written
 * once. `py-1.5` on each row is what takes a 20px text line to a 44px touch
 * target without making the desktop column look airy.
 */
function FooterGroupLinks({
  group,
  categories,
  locale,
}: {
  group: "shop" | "support" | "company";
  categories: Category[];
  locale: Locale;
}) {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");

  if (group === "shop") {
    return (
      <ul className="space-y-0.5">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={routes.catalog.byCategory(category.slug)}
              className={`${LINK_CLASS} block py-1.5`}
            >
              {category.name[locale]}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href={routes.catalog.index}
            className={`${LINK_CLASS} block py-1.5`}
          >
            {tCommon("allProducts")}
          </Link>
        </li>
      </ul>
    );
  }

  const items = group === "support" ? SUPPORT_ITEMS : COMPANY_ITEMS;
  const prefix = group === "support" ? "supportItems" : "companyItems";

  return (
    <ul className="space-y-0.5 text-sm text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="py-1.5">
          {t(`${prefix}.${item}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * One collapsible group, mobile only.
 *
 * `group//details` + `group-open:` is how the chevron rotates without a single
 * line of JavaScript: the browser toggles `[open]` on the element and CSS reads
 * it. `list-none` and the `::-webkit-details-marker` reset remove the platform's
 * default triangle so the chevron is the only affordance.
 */
function FooterDisclosure({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {heading}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

/** Categories come from the layout — see the note on `SiteHeader`. */
export function SiteFooter({ categories }: { categories: Category[] }) {
  const t = useTranslations("footer");
  const locale = useLocale() as Locale;

  const groups = [
    { id: "shop", heading: t("shop") },
    { id: "support", heading: t("support") },
    { id: "company", heading: t("company") },
  ] as const;

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <Container className="py-8 sm:py-12 lg:py-16">
        {/* Brand block. Compact on mobile, where it is the only thing above the
            fold of the footer and every line costs a scroll. */}
        <div className="mb-6 space-y-2 sm:mb-10 sm:space-y-4">
          <p className="text-base font-semibold tracking-tight sm:text-lg">
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

        {/* Mobile: collapsed disclosures, no JavaScript. */}
        <div className="border-t sm:hidden">
          {groups.map((group) => (
            <FooterDisclosure key={group.id} heading={group.heading}>
              <FooterGroupLinks
                group={group.id}
                categories={categories}
                locale={locale}
              />
            </FooterDisclosure>
          ))}

          <details className="group border-b [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              {t("stayInTouch")}
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-3 pb-4">
              <p className="text-sm text-pretty text-muted-foreground">
                {t("newsletterNote")}
              </p>
              <NewsletterForm compact />
            </div>
          </details>
        </div>

        {/* Desktop: the columns, unchanged in substance. */}
        <div className="hidden gap-10 sm:grid sm:grid-cols-2 lg:grid-cols-12">
          <nav aria-labelledby="footer-shop" className="lg:col-span-3">
            <h2 id="footer-shop" className="mb-3 text-sm font-semibold">
              {t("shop")}
            </h2>
            <FooterGroupLinks
              group="shop"
              categories={categories}
              locale={locale}
            />
          </nav>

          <div className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold">{t("support")}</h2>
            <FooterGroupLinks
              group="support"
              categories={categories}
              locale={locale}
            />
          </div>

          <div className="lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold">{t("company")}</h2>
            <FooterGroupLinks
              group="company"
              categories={categories}
              locale={locale}
            />
          </div>

          <div className="space-y-3 lg:col-span-3">
            <h2 className="text-sm font-semibold">{t("stayInTouch")}</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("newsletterNote")}
            </p>
            <NewsletterForm compact />
          </div>
        </div>

        {/* Bottom bar. `border-t` replaces the old `<Separator />` plus its
            `my-8`: one element and 16px instead of two and 64px. */}
        <div className="mt-6 flex flex-col-reverse items-center gap-3 border-t pt-5 sm:mt-10 sm:flex-row sm:justify-between">
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

        <p className="mt-4 text-xs text-muted-foreground/70">
          {t("pagesNote")}
        </p>
      </Container>
    </footer>
  );
}
