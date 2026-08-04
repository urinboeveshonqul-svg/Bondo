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
import { categories } from "@/mocks/catalog";

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
 * The account control is a button rather than a link: sign-in does not exist
 * until the auth phase, and the project does not ship links to routes that 404.
 */
export function SiteHeader() {
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

          <nav
            aria-label={t("mainNav")}
            className="hidden items-center gap-1 lg:flex"
          >
            <CategoriesMenu categories={categories} />
            <Button variant="ghost" size="sm" asChild>
              <Link href={routes.catalog.index}>{tCommon("allProducts")}</Link>
            </Button>
          </nav>

          {/* Search takes the free space on desktop; on smaller viewports it
              lives in the mobile panel instead, where there is room for it. */}
          <div className="hidden flex-1 justify-center px-4 lg:flex">
            <SearchBar className="max-w-md" />
          </div>

          <div className="ms-auto flex items-center gap-0.5 lg:ms-0">
            <LanguageSwitcher />
            <ThemeToggle />
            <WishlistSheet />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("account")}
              disabled
            >
              <User />
            </Button>
            <BasketSheet />
          </div>
        </div>
      </Container>
    </header>
  );
}
