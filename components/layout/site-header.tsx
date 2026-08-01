import Link from "next/link";
import { Menu, Search, ShoppingCart, User } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";

/**
 * Navigation placeholder.
 *
 * Structure and landmarks only. The category menu, search, cart badge and
 * account dropdown are wired up in later phases — the controls below are
 * intentionally inert rather than backed by placeholder data.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Container>
        <nav
          aria-label="Main"
          className="flex h-16 items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              disabled
            >
              <Menu />
            </Button>

            <Link
              href={routes.home}
              className="rounded-sm text-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {siteConfig.name}
            </Link>
          </div>

          {/* Category navigation, rendered from the database, goes here. */}

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Search" disabled>
              <Search />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Account" disabled>
              <User />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Cart" disabled>
              <ShoppingCart />
            </Button>
          </div>
        </nav>
      </Container>
    </header>
  );
}
