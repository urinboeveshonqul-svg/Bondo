"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import {
  buildCatalogHref,
  withCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * The sections of a department, as a bottom sheet.
 *
 * ## Why this exists
 *
 * `SubcategoryNav` renders its children as a horizontal scroller, which is fine
 * for a department with four or five of them. Aksessuarlar has fifteen. At 390px
 * that produced a **1825px** scroller sitting directly under the departments'
 * own **1682px** one — two sideways rails stacked on top of each other, 138px of
 * navigation before the first product, and no way to see the list as a list.
 * That is the "категории competing for the same horizontal space" problem
 * exactly.
 *
 * Past the threshold in `category-nav.tsx`, the row is replaced on mobile by one
 * 44px button that opens this sheet, where the sections are a vertical list a
 * thumb can scan and hit. Below it the row stays, because opening a sheet to
 * choose between four things is a tap nobody needed to make.
 *
 * The threshold lives there and not here on purpose: this is a Client
 * Component, and a plain constant exported from one reaches a Server Component
 * as a client reference rather than a number.
 *
 * Desktop is unaffected: from `lg` the sections wrap onto one or two lines and
 * there is room for them.
 *
 * ## Why a sheet and not a `<details>`
 *
 * The rest of this codebase reaches for `<details>` to avoid shipping JavaScript
 * (the footer, the mobile menu, the departments' "More"). It is the wrong choice
 * here: a disclosure expands *in place*, pushing the products down the page, so
 * a shopper opening the list loses the results they were looking at. A sheet
 * overlays, closes on Escape and on outside tap, and traps focus while open —
 * behaviour a `<summary>` does not have and that matters when the panel covers
 * the screen.
 */

export function SubcategorySheet({
  department,
  query,
}: {
  department: CategoryNavItem;
  query: CatalogQuery;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const hrefFor = (slug: string) =>
    buildCatalogHref(withCatalogQuery(query, { category: slug }));

  const active = department.children.find(
    (child) => child.slug === query.category,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/*
          The trigger states the current section rather than only "Sections", so
          the row still answers "where am I?" without being opened — the question
          the horizontal scroller answered by showing an active chip.
        */}
        <Button
          variant="outline"
          className="h-11 w-full justify-between px-3 text-sm font-normal"
        >
          <span className="min-w-0 truncate">
            {active ? active.name[locale] : t("sections")}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
      </SheetTrigger>

      {/*
        Bottom sheet, capped at 85% of the viewport: a phone's reachable area is
        the lower half of the screen, and a panel that starts at the top puts the
        first option under the thumb's furthest reach.
      */}
      <SheetContent side="bottom" className="max-h-[85svh] rounded-t-2xl">
        <SheetHeader className="pb-1">
          <SheetTitle className="text-start">
            {department.name[locale]}
          </SheetTitle>
          <SheetDescription className="text-start">
            {t("sectionsDescription")}
          </SheetDescription>
        </SheetHeader>

        <ul className="overflow-y-auto px-4 pb-8">
          <li>
            <SheetLink
              href={hrefFor(department.slug)}
              onNavigate={() => setOpen(false)}
              selected={query.category === department.slug}
            >
              {t("allInCategory")}
            </SheetLink>
          </li>

          {department.children.map((child) => (
            <li key={child.id}>
              <SheetLink
                href={hrefFor(child.slug)}
                onNavigate={() => setOpen(false)}
                selected={query.category === child.slug}
              >
                {child.name[locale]}
              </SheetLink>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

/**
 * One row. 48px rather than the 44px minimum: these sit in an unbroken vertical
 * stack with no gaps between them, and adjacent targets at exactly the minimum
 * are the arrangement WCAG 2.2 SC 2.5.8 warns about.
 */
function SheetLink({
  href,
  selected,
  onNavigate,
  children,
}: {
  href: string;
  selected: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={selected ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-lg px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted",
      )}
    >
      <span className="min-w-0">{children}</span>
      {selected ? (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
