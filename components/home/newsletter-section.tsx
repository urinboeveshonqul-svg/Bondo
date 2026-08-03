import { Mail } from "lucide-react";

import { Container } from "@/components/layout/container";
import { NewsletterForm } from "@/components/layout/newsletter-form";

/**
 * Newsletter band.
 *
 * Shares `NewsletterForm` with the footer rather than duplicating the markup,
 * so validation and the eventual Server Action are implemented once. This
 * wrapper only supplies the surrounding layout and copy.
 */
export function NewsletterSection() {
  return (
    <section
      aria-labelledby="newsletter-heading"
      className="border-t py-14 sm:py-20"
    >
      <Container>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
          <div className="rounded-full bg-primary-foreground/15 p-3">
            <Mail className="size-6" aria-hidden="true" />
          </div>

          <h2
            id="newsletter-heading"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Restock alerts, without the marketing
          </h2>

          <p className="max-w-xl text-pretty text-primary-foreground/80">
            Tell us once what you are waiting for and we will email when it is
            back. Twice a month at most, and nothing else.
          </p>

          <NewsletterForm className="max-w-md justify-center" />

          <p className="text-xs text-primary-foreground/70">
            Unsubscribe in one click. We never share your address.
          </p>
        </div>
      </Container>
    </section>
  );
}
