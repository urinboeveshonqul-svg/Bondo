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
 */
const REASONS = [
  {
    icon: ClipboardCheck,
    title: "Tested, not just assembled",
    body: "Every system runs 24 hours of thermal and stability testing. The results for your specific unit ship in the box.",
  },
  {
    icon: Headphones,
    title: "Answers with numbers in them",
    body: "Ask whether a cooler clears a memory kit and you get the height in millimetres, not a link to the product page.",
  },
  {
    icon: PackageCheck,
    title: "Packed for the courier it will meet",
    body: "Graphics cards are double-boxed with the connector supported. Nothing ships in a bag with a void in it.",
  },
  {
    icon: RotateCcw,
    title: "Thirty days, no argument",
    body: "Changed your mind or picked the wrong socket? Send it back unopened within thirty days and we refund it.",
  },
] as const;

export function ValueProps() {
  return (
    <Section
      title="Why buy from Bondo"
      description="Four things we do differently, all of which you can hold us to."
      muted
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="space-y-3 rounded-xl border bg-card p-6">
            <div className="inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <h3 className="font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-pretty text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
