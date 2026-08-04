import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A home page section: consistent vertical rhythm, heading and optional link.
 *
 * Every band on the landing page uses this, so the spacing scale is defined
 * once. Sections alternate background via the `muted` prop rather than each one
 * inventing its own padding and colour.
 *
 * The heading level is fixed at `h2`: the page has one `h1` in the hero, and
 * every section below it is a peer. Letting callers choose would let the
 * document outline drift.
 *
 * `id` is a required prop rather than a slug derived from `title`. It used to be
 * generated with `title.toLowerCase().replace(/[^a-z0-9]+/g, "-")`, which is
 * fine for "Today's deals" and produces `"section--"` for "Акции дня" — every
 * Russian section would share one id, so `aria-labelledby` on all of them would
 * resolve to whichever heading happened to be first. A caller-supplied,
 * language-independent id cannot drift with the copy.
 */
export function Section({
  id,
  title,
  description,
  href,
  linkLabel,
  muted = false,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  muted?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `section-${id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("py-14 sm:py-20", muted && "bg-muted/40", className)}
    >
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2
              id={headingId}
              className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            >
              {title}
            </h2>
            {description ? (
              <p className="max-w-2xl text-pretty text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {href && linkLabel ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {linkLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {children}
      </Container>
    </section>
  );
}
