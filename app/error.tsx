"use client";

import { useEffect } from "react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Route-level error boundary. Must be a Client Component — React needs to
 * attach it as an error boundary on the client.
 *
 * In production Next.js strips the real message and passes only `digest`, which
 * correlates with the full stack in the server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled route error", error, { digest: error.digest });
  }, [error]);

  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Something went wrong
      </h1>

      <p className="max-w-md text-pretty text-muted-foreground">
        We hit an unexpected error. Trying again often resolves it.
      </p>

      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}

      <Button onClick={reset}>Try again</Button>
    </Container>
  );
}
