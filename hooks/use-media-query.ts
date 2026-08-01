"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * Returns `false` on the server and during hydration, then the real value —
 * reading `window.matchMedia` during render would cause a hydration mismatch.
 * Prefer Tailwind's responsive variants for styling; reach for this only when
 * the breakpoint changes *behaviour* (which component renders, whether a
 * portal opens).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    setMatches(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", onChange);

    return () => mediaQuery.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
