"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Search, reachable from the mobile header in one tap.
 *
 * Search was previously only inside the menu panel, three interactions deep:
 * open the menu, find the field, type. On a computer shop that is the wrong
 * place for it — a shopper who knows they want an RTX 4070 should not have to
 * go through a category tree to say so.
 *
 * The field is not rendered inline in the header bar because a usable input and
 * a logo do not both fit at 375px; that constraint was real and has not changed.
 * What changed is that the icon now opens search directly instead of opening a
 * menu that contains it.
 *
 * A sheet from the top rather than a route: it opens over whatever the shopper
 * was looking at and closes back onto it, with no navigation and nothing to
 * fetch. `SearchBar` is reused unchanged, so there is one search implementation
 * and it cannot drift between the two places it appears.
 */
export function MobileSearch() {
  const t = useTranslations("header.search");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t("label")}
        >
          <Search />
        </Button>
      </SheetTrigger>

      <SheetContent side="top" className="pb-4">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-start text-base">{t("label")}</SheetTitle>
        </SheetHeader>

        {/*
          `autoFocus` is deliberate here and would be wrong almost anywhere else:
          the visitor tapped a control whose only purpose is to type, so raising
          the keyboard is what they asked for. Without it the sheet opens and a
          phone user taps a second time to reach the field.
        */}
        <div className="px-4">
          <SearchBar autoFocus onSubmitted={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
