import type { ReactNode } from "react";

/**
 * Passthrough root layout.
 *
 * The real layout — `<html>`, `<body>`, fonts, providers — lives at
 * `app/[locale]/layout.tsx`, because it cannot render `<html lang>` without
 * knowing the locale, and the locale is a URL segment below this point.
 *
 * This file still has to exist. Next.js resolves the `not-found.tsx` and
 * `error.tsx` conventions against the root of the `app/` tree, and with no root
 * layout it silently ignores `app/[locale]/not-found.tsx`: an unknown product
 * slug returned **200 with an empty body**, and an unmatched path fell through
 * to the framework's built-in English 404. Nothing was logged in either case.
 *
 * It deliberately renders no markup of its own. Two elements claiming to be the
 * document root would nest `<html>` inside `<html>`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
