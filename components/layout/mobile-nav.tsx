"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Menu } from "lucide-react";

import { CategoryIcon } from "@/components/layout/category-icon";
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
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { siteConfig, type Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * Mobile navigation: a category accordion of unlimited depth.
 *
 * Holds its own open state so selecting a link closes the panel — without this
 * the sheet stays open over the page the visitor just navigated to, which on a
 * phone looks like the tap did nothing.
 *
 * Search is repeated inside rather than shown in the collapsed header bar,
 * because a usable search field and a logo do not both fit at 375px.
 *
 * ## Why `<details>` rather than the Accordion primitive
 *
 * Same reasoning as the footer's disclosures. `<details>`/`<summary>` is the
 * browser's own disclosure widget: it needs no JavaScript to expand, no ARIA
 * attributes to be announced correctly, and no hydration to work on a slow
 * connection. Radix's Accordion would add a controlled-state component per
 * level and re-implement what the platform already does.
 *
 * The consequence worth stating: the open/close **animation** is CSS on the
 * chevron and the content, not a measured height transition, because
 * `<details>` cannot animate its own disclosure. That is the trade — the panel
 * snaps rather than sliding, and in exchange it opens on the first tap instead
 * of after hydration.
 *
 * ## Depth
 *
 * `CategoryBranch` renders itself for its own children, so a third or fourth
 * level nests without a change here. A leaf renders a plain link; a node with
 * children renders a disclosure whose *summary* is also a link to that
 * category, so tapping "Components" can either open it or go to its listing —
 * the chevron is the control that expands, the label is the one that navigates.
 */
export function MobileNav({ categories }: { categories: CategoryNavItem[] }) {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t("openMenu")}
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

          {categories.length > 0 ? (
            <nav aria-label={t("categoriesNav")}>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("shopByCategory")}
              </h3>
              <ul className="flex flex-col">
                {categories.map((category) => (
                  <li key={category.id}>
                    <CategoryBranch
                      item={category}
                      locale={locale}
                      onNavigate={close}
                    />
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <Separator />

          <Link
            href={routes.catalog.index}
            onClick={close}
            className="-mx-2 rounded-md px-2 py-2.5 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {tCommon("allProducts")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Every row is 44px tall — WCAG 2.2 SC 2.5.8, and a thumb is not a cursor. */
const ROW = "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm";

function CategoryBranch({
  item,
  locale,
  onNavigate,
  depth = 0,
}: {
  item: CategoryNavItem;
  locale: Locale;
  onNavigate: () => void;
  depth?: number;
}) {
  const t = useTranslations("header");

  if (item.children.length === 0) {
    return (
      <Link
        href={routes.catalog.byCategory(item.slug)}
        onClick={onNavigate}
        className={cn(
          ROW,
          "-mx-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          depth > 0 && "text-muted-foreground",
        )}
      >
        <CategoryIcon name={item.icon} className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{item.name[locale]}</span>
      </Link>
    );
  }

  return (
    <details className="group">
      {/*
        The summary carries the expand control only. The category's own link
        sits inside it as a separate target, so "open Components" and "go to
        Components" are two different taps rather than one ambiguous one — on a
        phone, a label that sometimes navigates and sometimes expands is the
        commonest reason a menu feels broken.
      */}
      <summary
        className={cn(
          ROW,
          "-mx-2 cursor-pointer list-none justify-between font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden",
        )}
        aria-label={`${item.name[locale]} — ${t("expandCategory")}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CategoryIcon name={item.icon} className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{item.name[locale]}</span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <ul className="ms-3 border-s ps-2 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
        <li>
          <Link
            href={routes.catalog.byCategory(item.slug)}
            onClick={onNavigate}
            className={cn(
              ROW,
              "-mx-2 font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            {t("viewAllIn", { category: item.name[locale] })}
          </Link>
        </li>

        {item.children.map((child) => (
          <li key={child.id}>
            <CategoryBranch
              item={child}
              locale={locale}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}
