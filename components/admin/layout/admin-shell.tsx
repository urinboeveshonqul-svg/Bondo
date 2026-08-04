"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
} from "lucide-react";

import { AdminSidebar } from "@/components/admin/layout/admin-sidebar";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AdminNavSection } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";

/**
 * The admin chrome: sidebar, top bar and the content column.
 *
 * Desktop-first, as the brief asks, but not desktop-only. Three layouts from one
 * tree:
 *
 * - **≥ `lg`** — a persistent sidebar, collapsible to icons for people who want
 *   the width back. Collapsing hides labels but keeps them in the accessibility
 *   tree via `sr-only`, so the navigation does not become unusable by screen
 *   reader to save 200 pixels.
 * - **`md`–`lg`** — the sidebar collapses to icons by default; tablets have the
 *   height but not the width.
 * - **< `md`** — the sidebar moves into a drawer behind a menu button, and
 *   choosing a link closes it. Without that the panel sits over the page the
 *   admin just navigated to, which reads as a dead tap.
 *
 * The top bar is sticky. An admin scrolling a 50-row table should not have to
 * return to the top to reach search or switch language.
 *
 * `children` is rendered by the server layout above this — the shell holds only
 * layout state, so the pages inside stay Server Components.
 */
export function AdminShell({
  sections,
  topbar,
  children,
}: {
  sections: readonly AdminNavSection[];
  /** Search, quick actions, notifications and the user menu, built server-side. */
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-muted/30">
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 border-e bg-background p-3 transition-[width] duration-200 md:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <AdminSidebar sections={sections} collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label={t("nav.openMenu")}
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("nav.label")}</SheetTitle>
                </SheetHeader>
                <div className="h-full p-3">
                  <AdminSidebar
                    sections={sections}
                    onNavigate={() => setDrawerOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              {topbar}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>

          {/*
            Unmissable, and deliberately not dismissible. There is no
            authentication in front of this panel yet (K-1, K-2); anyone reading
            it should know that before they trust anything on screen.
          */}
          <p
            role="status"
            className="flex items-start gap-2 border-t bg-foreground/5 px-3 py-1.5 text-xs text-muted-foreground sm:px-4"
          >
            <TriangleAlert
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium text-foreground">
                {t("preview.label")}
              </span>{" "}
              {t("preview.body")}
            </span>
          </p>
        </header>

        <main id="admin-main" className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
