import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, Wrench } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

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

const ASSURANCES = [
  { icon: Wrench, label: "Built and tested in-house" },
  { icon: ShieldCheck, label: "Three-year warranty" },
  { icon: Truck, label: "Free delivery over $150" },
] as const;

export function Hero() {
  return (
    <section className="border-b">
      <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Built for people who read the spec sheet
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Components chosen on merit, not margin
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Every system we build is assembled, cable-managed and burned in for
            24 hours before it ships — and leaves with its own test results
            attached, not the model&rsquo;s.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href={routes.catalog.index}>
                Browse the catalog
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={routes.catalog.byCategory("gaming-pcs")}>
                Prebuilt systems
              </Link>
            </Button>
          </div>

          <ul className="grid gap-3 pt-2 text-sm text-muted-foreground sm:grid-cols-3">
            {ASSURANCES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon
                  className="size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Deliberately a typographic panel rather than a product photograph —
            see the note in `ProductImage` on why nothing here fakes imagery. */}
        <div className="relative hidden aspect-4/3 items-center justify-center rounded-2xl border bg-muted/60 lg:flex">
          <div className="space-y-2 text-center">
            <p className="text-6xl font-semibold tracking-tight text-muted-foreground/50">
              24h
            </p>
            <p className="max-w-xs px-8 text-sm text-pretty text-muted-foreground">
              Every build runs a full day of thermal and stability testing
              before it is boxed.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
