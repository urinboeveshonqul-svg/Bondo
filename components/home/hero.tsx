import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Truck, Wrench } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { formatPrice } from "@/utils/format";

/**
 * Hero.
 *
 * Carries the page's only `h1`. Everything below is an `h2` inside `Section`,
 * so the document outline is one level deep and predictable to a screen reader
 * navigating by heading.
 *
 * No carousel. Rotating heroes measure badly, move under the pointer, and need
 * pause controls to be accessible — a single clear statement outperforms one on
 * every count that matters here.
 */

/** Icons paired with their translation key; the copy lives in `home.json`. */
const ASSURANCES = [
  { icon: Wrench, key: "built" },
  { icon: ShieldCheck, key: "warranty" },
  { icon: Truck, key: "delivery" },
] as const;

/** Free-delivery threshold, in integer minor units like every other amount. */
const FREE_DELIVERY_THRESHOLD_CENTS = 15000;

export function Hero() {
  const t = useTranslations("home.hero");
  const locale = useLocale() as Locale;

  // Formatted, not interpolated as a bare "$150": the threshold is a monetary
  // amount and has to follow the same locale rules as every price on the page.
  const threshold = formatPrice(FREE_DELIVERY_THRESHOLD_CENTS, locale);

  return (
    <section className="border-b">
      <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            {t("eyebrow")}
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {t("body")}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={routes.catalog.index}>
                {t("browseCatalog")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={routes.catalog.byCategory("gaming-pcs")}>
                {t("prebuilt")}
              </Link>
            </Button>
          </div>

          <ul className="grid gap-3 pt-2 text-sm text-muted-foreground sm:grid-cols-3">
            {ASSURANCES.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-2">
                <Icon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {t(`assurances.${key}`, { amount: threshold })}
              </li>
            ))}
          </ul>
        </div>

        {/* Deliberately a typographic panel rather than a product photograph —
            see the note in `ProductImage` on why nothing here fakes imagery. */}
        <div className="relative hidden aspect-4/3 items-center justify-center rounded-2xl border bg-muted/60 lg:flex">
          <div className="space-y-2 text-center">
            <p className="text-6xl font-semibold tracking-tight text-muted-foreground/50">
              {t("panelValue")}
            </p>
            <p className="max-w-xs px-8 text-sm text-pretty text-muted-foreground">
              {t("panelBody")}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
