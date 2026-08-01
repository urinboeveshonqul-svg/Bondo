"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";

/**
 * Last-resort error boundary, for errors thrown by the root layout itself.
 *
 * `app/error.tsx` sits *inside* the root layout, so it cannot catch a failure
 * in the layout that renders it. This one replaces the entire document, which
 * is why it has to supply its own `<html>` and `<body>`.
 *
 * It also renders outside the app shell, so it cannot use `SiteHeader`,
 * `Container` or anything else that might be implicated in the failure — and
 * its styles are inline, because a broken stylesheet is one of the things that
 * can land a user here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Root layout error", error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#171717",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>

          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            We hit an unexpected error and could not load the page.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "0 0 1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#666",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: 0,
              background: "#171717",
              color: "#fff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
