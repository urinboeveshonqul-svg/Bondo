import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/**
 * Root 404. Rendered for unmatched URLs and for any `notFound()` call that is
 * not caught by a nearer `not-found.tsx`.
 */
export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <p className="font-mono text-sm text-muted-foreground">404</p>

      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        This page doesn&apos;t exist
      </h1>

      <p className="max-w-md text-pretty text-muted-foreground">
        The page you are looking for may have been moved or removed.
      </p>

      <Button asChild>
        <Link href={routes.home}>Back to home</Link>
      </Button>
    </Container>
  );
}
