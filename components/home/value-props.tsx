import { useTranslations } from "next-intl";
import {
  ClipboardCheck,
  Headphones,
  PackageCheck,
  RotateCcw,
} from "lucide-react";

import { Section } from "@/components/layout/section";

/**
 * Why choose us.
 *
 * Four claims, each specific enough to be falsifiable. "Great service" is not a
 * reason to buy from anyone; "we answer with the actual measurement" is, and it
 * is the kind of promise a support team can be held to.
 *
 * Icons live here, copy lives in `home.json` — the pairing is presentation, the
 * claims are content.
 */
const REASONS = [
  { icon: ClipboardCheck, key: "tested" },
  { icon: Headphones, key: "answers" },
  { icon: PackageCheck, key: "packed" },
  { icon: RotateCcw, key: "returns" },
] as const;

export function ValueProps() {
  const t = useTranslations("home.valueProps");

  return (
    <Section
      id="value-props"
      title={t("title")}
      description={t("description")}
      muted
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map(({ icon: Icon, key }) => (
          <li key={key} className="space-y-3 rounded-xl border bg-card p-6">
            <div className="inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <h3 className="font-semibold tracking-tight">
              {t(`${key}.title`)}
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">
              {t(`${key}.body`)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
