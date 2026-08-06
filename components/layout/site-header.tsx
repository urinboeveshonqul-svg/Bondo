import { useTranslations } from "next-intl";
import { User } from "lucide-react";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BasketSheet, WishlistSheet } from "@/components/layout/basket-sheet";
import { CategoriesMenu } from "@/components/layout/categories-menu";
import { Container } from "@/components/layout/container";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchBar } from "@/components/layout/search-bar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * Site header.
 *
 * A Server Component that composes Client Components for the parts that need
 * interactivity — the menu, search, basket, language and theme toggles each
 * carry their own `"use client"`, and the shell around them does not (ADR-6).
 *
 * Sticky, with `backdrop-blur`, so the catalog stays reachable while scrolling
 * a long listing. `z-50` puts it above page content but below the sheet
 * overlays it opens.
 *
 * The account control links to `/account`. Anonymous visitors are redirected to
 * sign-in by the middleware, carrying `redirectTo`, so the header does not need
 * to know who is signed in — which keeps it out of the per-request auth read
 * that would otherwise run on every page (ADR-11).
 */
/**
 * Categories are passed in by the layout rather than fetched here: the header
 * is rendered on every page, and a component that fetches its own navigation
 * turns one query into one per render tree. They arrive already nested, so the
 * mega menu and the mobile accordion render from the same tree.
 */
export function SiteHeader({ categories }: { categories: CategoryNavItem[] }) {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container>
        <div className="flex h-16 items-center gap-3">
          <MobileNav categories={categories} />

          <Link
            href={routes.home}
            className="shrink-0 rounded-sm text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {siteConfig.name}
          </Link>

          {/*
            The mega menu brings its own <nav aria-label="Categories">, so this
            wrapper is a plain flex row rather than a second landmark — two
            nested navigation landmarks make a screen reader's landmark list
            report a region inside a region for no benefit.
          */}
          <div className="hidden items-center gap-1 lg:flex">
            <CategoriesMenu categories={categories} />
            <Button variant="ghost" size="sm" asChild>
              <Link href={routes.catalog.index}>{tCommon("allProducts")}</Link>
            </Button>
          </div>

          {/* Search takes the free space on desktop; on smaller viewports it
              lives in the mobile panel instead, where there is room for it. */}
          <div className="hidden flex-1 justify-center px-4 lg:flex">
            <SearchBar className="max-w-md" />
          </div>

          <div className="ms-auto flex items-center gap-0.5 lg:ms-0">
            <LanguageSwitcher />
            <ThemeToggle />
            <WishlistSheet />
            <Button variant="ghost" size="icon" asChild>
              <Link href={routes.account.index} aria-label={t("account")}>
                <User />
              </Link>
            </Button>
            <BasketSheet />
          </div>
        </div>
      </Container>
    </header>
  );
}
