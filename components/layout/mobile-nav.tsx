"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";

import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import type { Category } from "@/types/catalog";

/**
 * Mobile navigation.
 *
 * Holds its own open state so selecting a link closes the panel — without this
 * the sheet stays open over the page the visitor just navigated to, which on a
 * phone looks like the tap did nothing.
 *
 * Search is repeated inside rather than shown in the collapsed header bar,
 * because a usable search field and a logo do not both fit at 375px.
 */
export function MobileNav({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      {/* `side` takes physical names, not logical ones — there is no "start". */}
      <SheetContent side="left" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle className="text-start">{siteConfig.name}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-8">
          <SearchBar />

          <nav aria-label="Categories">
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Shop by category
            </h3>
            <ul className="flex flex-col">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={routes.catalog.byCategory(category.slug)}
                    onClick={() => setOpen(false)}
                    className="-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-2.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Separator />

          <Link
            href={routes.catalog.index}
            onClick={() => setOpen(false)}
            className="-mx-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            All products
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
