import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { siteConfig, type Locale } from "@/lib/site-config";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * Site footer.
 *
 * A Server Component with no client JavaScript at all — the mobile disclosures
 * are `<details>`, which the browser opens on its own.
 *
 * ## What is here, and what is deliberately not
 *
 * The footer shows **only destinations that exist**. That is the rule from
 * CLAUDE.md § 5 ("no dead links") and it is what decided this layout:
 *
 * | Asked for                              | Here?                                         |
 * | -------------------------------------- | --------------------------------------------- |
 * | Departments, all products              | ✅ real routes                                |
 * | Account, order tracking                | ✅ `/account`, `/account/orders`              |
 * | Delivery, warranty, returns, contact…  | ❌ **no such pages exist** — see below        |
 * | Newsletter form                        | ❌ nothing records a signup                   |
 * | Social links                           | ❌ no account is configured                   |
 * | Privacy / Terms in the bottom bar      | ❌ no such pages exist                        |
 *
 * The previous version rendered the missing ones as **inert grey text** with a
 * footnote apologising for them. That is worse than omitting them: it fills two
 * columns with things that look like links, do nothing, and tell every visitor
 * the shop is unfinished. `content_pages` exists in the schema and has no rows;
 * writing delivery windows, warranty terms and a returns policy is the
 * business's job, not this component's, and inventing them would be the fake
 * content ADR-20 forbids. They come back as links the day the pages have copy.
 *
 * Likewise the newsletter: `NewsletterForm` has no endpoint behind it and says
 * so in a toast. A signup box that records nothing is a promise the shop cannot
 * keep, so it is not in the footer. (It still appears in the home page's own
 * newsletter band, which is outside this component.)
 *
 * And the social row was four hardcoded strings — `X`, `YouTube`, `LinkedIn`,
 * `GitHub` — for accounts that do not exist, under a label that admitted they
 * were "not yet live". Gone entirely.
 *
 * ## Why the mobile groups are `<details>` and not the Accordion primitive
 *
 * `components/ui/accordion.tsx` is Radix, and Radix is a Client Component. Using
 * it would turn the footer — server-rendered markup on every page of the site —
 * into a hydration root, to animate two disclosure triangles.
 * `<details>`/`<summary>` is the platform's own disclosure widget: it opens with
 * no JavaScript, it is keyboard operable and correctly announced without a
 * single ARIA attribute, and it survives hydration failing entirely.
 *
 * The cost is that `<details>` cannot be forced open by CSS at a breakpoint —
 * the `open` attribute governs it, not a stylesheet. So each group's markup is
 * rendered twice, once inside `<details>` for mobile and once as a plain column
 * for `sm:` and up, with `FooterLinks` shared between them so the list itself is
 * written once. That is a few hundred bytes of duplicated static HTML against a
 * client bundle and a hydration pass on every route.
 */

/**
 * How many departments the Shop column lists.
 *
 * A layout decision, not a taxonomy one: seven rows plus "All products" is the
 * height that balances against the brand column. **Which** seven is the
 * operator's call — this takes them in `display_order`, so reordering
 * departments in `/admin/categories` reorders the footer. Nothing here names a
 * category (CLAUDE.md § 12); the full hierarchy lives in the mega menu, which is
 * where a shopper browsing by category should be.
 */
const FOOTER_DEPARTMENTS = 7;

/**
 * A footer link row.
 *
 * **44px on touch, 32px from `sm`.** The previous version used `py-1.5` alone
 * and carried a comment claiming that made a 44px target; it does not — 20px of
 * line box plus 12px of padding is 32px, and the claim had been in the file
 * since the last footer pass. Measured, not re-derived from the comment.
 *
 * 32px clears WCAG 2.2 SC 2.5.8 (24×24) on its own, so the desktop columns are
 * conformant as well as compact. `min-h-11` is scoped to the phone, where the
 * pointer is a thumb and the 44px guideline earns its height — and where these
 * rows sit inside a collapsed disclosure anyway, so it costs the closed footer
 * nothing.
 */
const LINK_CLASS =
  "flex min-h-11 items-center rounded-sm py-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-h-8";

/** Small, but clearly a heading. Not a shouty one — this is a footer. */
const HEADING_CLASS = "text-xs font-semibold tracking-wide uppercase";

type FooterGroup = "shop" | "support" | "company";

/**
 * The support and company columns, as routes rather than labels.
 *
 * Every entry is a page that exists and is published — the five business-
 * information pages plus the order history. The order is the display order.
 *
 * **Privacy and terms are absent, and so are "build service" and "business
 * accounts".** No approved copy exists for any of them, and a footer link to a
 * page nobody has written is either a 404 or invented policy (**ADR-77**).
 * Adding one back is one line here plus its row in `content_pages`.
 */
const SUPPORT_LINKS = [
  { key: "delivery", href: routes.info.delivery },
  { key: "warranty", href: routes.info.warranty },
  { key: "returns", href: routes.info.returns },
  { key: "contact", href: routes.info.contact },
] as const;

const COMPANY_LINKS = [
  { key: "about", href: routes.info.about },
  { key: "account", href: routes.account.index },
  { key: "orders", href: routes.account.orders },
] as const;

/**
 * One group's links, without its heading.
 *
 * Shared by the mobile disclosure and the desktop column, so the list exists
 * once — see `LINK_CLASS` for how one set of rows is sized for both.
 */
function FooterLinks({
  group,
  departments,
  locale,
}: {
  group: FooterGroup;
  departments: CategoryNavItem[];
  locale: Locale;
}) {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");

  if (group === "shop") {
    return (
      // Eight departments stacked in one column were 256px, and that column
      // alone decided the footer's height. Two sub-columns from `sm` make it
      // four rows without dropping a link or shrinking a touch target.
      <ul className="sm:grid sm:grid-cols-2 sm:gap-x-6">
        {departments.map((department) => (
          <li key={department.id}>
            <Link
              href={routes.catalog.byCategory(department.slug)}
              className={LINK_CLASS}
            >
              {department.name[locale]}
            </Link>
          </li>
        ))}
        <li>
          <Link href={routes.catalog.index} className={LINK_CLASS}>
            {tCommon("allProducts")}
          </Link>
        </li>
      </ul>
    );
  }

  const links = group === "support" ? SUPPORT_LINKS : COMPANY_LINKS;
  const prefix = group === "support" ? "supportItems" : "companyItems";

  return (
    <ul>
      {links.map((link) => (
        <li key={link.key}>
          <Link href={link.href} className={LINK_CLASS}>
            {t(`${prefix}.${link.key}`)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * One collapsible group, mobile only.
 *
 * `group` + `group-open:` is how the chevron rotates without a line of
 * JavaScript: the browser toggles `[open]` and CSS reads it. `list-none` and the
 * `::-webkit-details-marker` reset remove the platform triangle so the chevron
 * is the only affordance.
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
      <summary
        className={`${HEADING_CLASS} flex min-h-11 cursor-pointer list-none items-center justify-between focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
      >
        {heading}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/** Categories come from the layout — see the note on `SiteHeader`. */
export function SiteFooter({ categories }: { categories: CategoryNavItem[] }) {
  const t = useTranslations("footer");
  const locale = useLocale() as Locale;

  // The tree's top level. `categories` is already nested and ordered, so this is
  // a slice rather than a filter over 102 rows.
  const departments = categories.slice(0, FOOTER_DEPARTMENTS);

  const groups = [
    { id: "shop", heading: t("shop") },
    { id: "support", heading: t("support") },
    { id: "company", heading: t("company") },
  ] as const;

  return (
    // `mt-auto` is what keeps the footer at the bottom of a short page. The body
    // is `flex min-h-svh flex-col` and `<main>` is `flex-1`, so main already
    // absorbs the slack — this is the belt to that pair of braces, and costs
    // nothing.
    <footer className="mt-auto border-t bg-muted/40">
      {/*
        40px of padding at every width, 48px from `lg`. The old value was
        `py-8 sm:py-12 lg:py-16` — 128px top and bottom on a desktop, which is
        most of why the footer measured 870px.
      */}
      <Container className="py-10 lg:py-12">
        {/*
          Two columns from `sm`, four from `lg`. Twelve tracks rather than four
          so the brand can take three of them and still read as a paragraph
          rather than a column of two-word lines.

          The department list is what decides this footer's height, so it goes
          two-across from `sm` too — eight rows stacked made the tablet footer
          **taller than the desktop one** (546px at 768px against 314px at
          1280px) before that was fixed. Measured at every breakpoint, not
          assumed.
        */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10">
          {/* Column 1 — the brand. */}
          <div className="space-y-2.5 sm:col-span-2 lg:col-span-4">
            <p className="text-base font-semibold tracking-tight">
              {siteConfig.name}
            </p>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              {t("tagline")}
            </p>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {t("warranty")}
            </p>
          </div>

          {/* Mobile: the same two groups, collapsed. `sm:hidden` rather than a
              separate component, so the link markup below is the same markup. */}
          <div className="-mt-2 sm:hidden">
            {groups.map((group) => (
              <FooterDisclosure key={group.id} heading={group.heading}>
                <FooterLinks
                  group={group.id}
                  departments={departments}
                  locale={locale}
                />
              </FooterDisclosure>
            ))}
          </div>

          {/* Desktop columns 2, 3 and 4. */}
          {groups.map((group) => (
            <nav
              key={group.id}
              aria-labelledby={`footer-${group.id}`}
              className={
                group.id === "shop"
                  ? "hidden sm:block lg:col-span-4"
                  : "hidden sm:block lg:col-span-2"
              }
            >
              {/*
                `h2`, not `h3`: the columns sit directly under the page `h1`, so
                anything lower would skip a level for a screen reader walking the
                document outline down into the footer.
              */}
              <h2 id={`footer-${group.id}`} className={`${HEADING_CLASS} mb-2`}>
                {group.heading}
              </h2>
              <FooterLinks
                group={group.id}
                departments={departments}
                locale={locale}
              />
            </nav>
          ))}
        </div>

        {/* Bottom bar. One line, 16px of padding above it. */}
        <div className="mt-8 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {/*
              The year is a plain string rather than a number: a copyright year
              is an identifier, and `Intl` would render 2026 as "2,026" in
              English and "2 026" in Russian.
            */}
            {t("copyright", { year: String(new Date().getFullYear()) })}
          </p>
        </div>
      </Container>
    </footer>
  );
}
