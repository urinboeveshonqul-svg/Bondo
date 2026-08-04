"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Route-level error boundary. Must be a Client Component — React needs to
 * attach it as an error boundary on the client.
 *
 * It sits inside the locale layout, so the i18n provider is above it and
 * translations resolve normally. `app/global-error.tsx` is the one that cannot
 * rely on that, and carries its own copy.
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
  const t = useTranslations("errors.route");

  useEffect(() => {
    logger.error("Unhandled route error", error, { digest: error.digest });
  }, [error]);

  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {t("title")}
      </h1>

      <p className="max-w-md text-pretty text-muted-foreground">
        {t("description")}
      </p>

      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}

      <Button onClick={reset}>{t("tryAgain")}</Button>
    </Container>
  );
}
