"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Light/dark toggle.
 *
 * Renders a non-interactive placeholder until mounted. The resolved theme is
 * unknowable on the server — it comes from `localStorage` or the OS — so
 * rendering the real icon during SSR guarantees a hydration mismatch. The
 * placeholder reserves the same box, so nothing shifts when it resolves.
 *
 * Cycles between light and dark only. "System" remains the default until the
 * visitor expresses a preference, but a three-way toggle in the header is a
 * control nobody reads carefully; the explicit choice wins once made.
 */
export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-hidden="true"
        tabIndex={-1}
        disabled
      >
        <Sun />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? t("toLight") : t("toDark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
