import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
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

const SUPPORT_ITEMS = [
  "Contact support",
  "Delivery and returns",
  "Warranty claims",
  "Order tracking",
] as const;

const COMPANY_ITEMS = [
  "About Bondo",
  "Build service",
  "Business accounts",
  "Careers",
] as const;

/**
 * Social channels, as text rather than icons.
 *
 * lucide-react v1 removed brand glyphs, and substituting a generic icon for a
 * platform mark is the same mistake as inventing a manufacturer logo — it
 * implies a relationship that does not exist. When the accounts are real, the
 * platforms' own licensed marks go here.
 */
const SOCIAL_CHANNELS = ["X", "YouTube", "LinkedIn", "GitHub"] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <Container className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <p className="text-lg font-semibold tracking-tight">
              {siteConfig.name}
            </p>
            <p className="max-w-sm text-sm text-pretty text-muted-foreground">
              {siteConfig.description}
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              Three-year warranty on every system we build
            </p>
          </div>

          <nav aria-labelledby="footer-shop" className="lg:col-span-2">
            <h2 id="footer-shop" className="mb-3 text-sm font-semibold">
              Shop
            </h2>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={routes.catalog.byCategory(category.slug)}
                    className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={routes.catalog.index}
                  className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  All products
                </Link>
              </li>
            </ul>
          </nav>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Support</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {SUPPORT_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Company</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {COMPANY_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 lg:col-span-2">
            <h2 className="text-sm font-semibold">Stay in touch</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Restock alerts and build guides. No more than twice a month.
            </p>
            <NewsletterForm compact />
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>

          <ul
            aria-label="Social channels, not yet live"
            className="flex items-center gap-4 text-xs text-muted-foreground"
          >
            {SOCIAL_CHANNELS.map((channel) => (
              <li key={channel}>{channel}</li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/70">
          Support, warranty and company pages are listed above and arrive with
          the content phase. They are shown as plain text rather than links
          until the pages exist.
        </p>
      </Container>
    </footer>
  );
}
