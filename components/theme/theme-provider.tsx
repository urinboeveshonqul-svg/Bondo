"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme provider.
 *
 * A thin wrapper so the root layout stays a Server Component — only this file
 * carries `"use client"`, and it renders `children` through, so everything
 * inside remains server-rendered (ADR-6).
 *
 * `next-themes` writes the class onto `<html>` from an inline script that runs
 * before paint, which is why the layout sets `suppressHydrationWarning` on that
 * element: the server cannot know the visitor's stored preference, so the
 * attribute legitimately differs on the first client pass. It is scoped to
 * `<html>` and does not suppress warnings anywhere else in the tree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Transitions during a theme switch animate every colour on the page at
      // once, which reads as a flash rather than a transition.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
