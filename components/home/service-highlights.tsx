import { useTranslations } from "next-intl";

import { HighlightIcon } from "@/components/home/highlight-icon";
import { Section } from "@/components/layout/section";
import type { Locale } from "@/lib/site-config";
import type { ServiceHighlight } from "@/services/service-highlights.service";

/**
 * The trust row, directly under the hero.
 *
 * Six short promises a shopper reads before deciding whether to buy from a shop
 * they have not used before: how long the warranty runs, how fast it is built,
 * whether it is delivered to them, who assembles it, whether it is tested, and
 * whether the parts are genuine. Each one is a commitment somebody could hold
 * the shop to, which is the only kind of claim worth putting here — "premium
 * quality" is not a reason to trust anybody.
 *
 * **The content is rows, not code.** These come from `service_highlights` and an
 * operator edits them in the admin: the copy, the icon, the order and whether
 * each is shown. That is why this component takes a list and renders it rather
 * than owning the claims — a warranty period changing should not be a deploy.
 *
 * Renders nothing when the list is empty. A trust section with no content is
 * worse than none: the heading promises reasons and then shows a gap.
 */
export function ServiceHighlights({
  highlights,
  locale,
}: {
  highlights: ServiceHighlight[];
  locale: Locale;
}) {
  const t = useTranslations("home.valueProps");

  if (highlights.length === 0) return null;

  return (
    <Section id="service-highlights" title={t("title")} muted>
      {/*
        A list, because it is one. Screen readers announce the count, which tells
        somebody scanning by keyboard how much is here before they walk it.

        The grid goes 1 → 2 → 3 rather than 1 → 2 → 4: six cards over four
        columns leaves two stranded on a second row, and three columns divides
        the default set evenly at both breakpoints.
      */}
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {highlights.map((highlight) => (
          <li
            key={highlight.id}
            // `min-w-0` because the descriptions are operator-authored and a
            // long unbroken word would otherwise widen the grid item past its
            // column — the same `min-width: auto` trap the reviews grid hit.
            className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5 sm:p-6"
          >
            <span className="inline-flex w-fit rounded-lg bg-primary/10 p-2.5 text-primary">
              <HighlightIcon name={highlight.icon} />
            </span>
            <h3 className="font-semibold tracking-tight break-words">
              {highlight.title[locale]}
            </h3>
            <p className="text-sm text-pretty break-words text-muted-foreground">
              {highlight.description[locale]}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
