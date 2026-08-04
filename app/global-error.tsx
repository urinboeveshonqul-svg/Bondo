"use client";

import { useEffect } from "react";

import { logger } from "@/lib/logger";
import { defaultLocale, isLocale, localeConfig } from "@/lib/site-config";

/**
 * Last-resort error boundary, for errors thrown by the root layout itself.
 *
 * `app/[locale]/error.tsx` sits *inside* the locale layout, so it cannot catch a
 * failure in the layout that renders it. This one replaces the entire document,
 * which is why it has to supply its own `<html>` and `<body>`.
 *
 * It renders outside the app shell — and therefore outside
 * `NextIntlClientProvider` — so it cannot use `useTranslations`. The provider is
 * mounted by the layout that just failed; reaching for it here would throw a
 * second error inside the handler for the first, and the visitor would get a
 * blank page instead of a message.
 *
 * So the copy is inlined, deliberately and exceptionally. This is the one file
 * in the project exempt from "never hardcode user-facing text", for the same
 * reason its styles are inline rather than in a stylesheet: a broken stylesheet
 * and a broken message bundle are both things that can land somebody here. Four
 * strings × three languages is a small, self-contained duplication and it cannot
 * fail.
 *
 * The locale is read from the URL rather than from a hook, because the URL is
 * still trustworthy when nothing else is.
 */
const COPY = {
  uz: {
    title: "Xatolik yuz berdi",
    body: "Kutilmagan xatolik yuz berdi va sahifani yuklab bo'lmadi.",
    reference: "Xatolik kodi:",
    retry: "Qayta urinish",
  },
  ru: {
    title: "Что-то пошло не так",
    body: "Произошла непредвиденная ошибка, страницу загрузить не удалось.",
    reference: "Код ошибки:",
    retry: "Повторить",
  },
  en: {
    title: "Something went wrong",
    body: "We hit an unexpected error and could not load the page.",
    reference: "Reference:",
    retry: "Try again",
  },
} as const;

function localeFromPath(): keyof typeof COPY {
  // `window` is undefined while this renders on the server; the default locale
  // is the honest answer there, and the client re-render corrects it.
  if (typeof window === "undefined") return defaultLocale;

  const [, first = ""] = window.location.pathname.split("/");
  return isLocale(first) ? first : defaultLocale;
}

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

  const locale = localeFromPath();
  const copy = COPY[locale];

  return (
    <html lang={localeConfig[locale].tag}>
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
            {copy.title}
          </h1>

          <p style={{ margin: "0 0 1.5rem", lineHeight: 1.6 }}>{copy.body}</p>

          {error.digest ? (
            <p
              style={{
                margin: "0 0 1.5rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#666",
              }}
            >
              {copy.reference} {error.digest}
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
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
