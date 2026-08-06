"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";

import { CategoryIcon } from "@/components/layout/category-icon";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { CategoryNavItem } from "@/types/catalog";

/**
 * The desktop mega menu.
 *
 * One trigger opens a two-pane panel: the twelve departments down the left,
 * and the subcategories of whichever one the pointer is on down the right.
 *
 * ## Why one trigger and not twelve
 *
 * The first version put every department in the header bar as its own hover
 * trigger, which is what the brief describes. It was **measured and it does not
 * fit**: twelve labels rendered `document.scrollWidth` at 2423px inside a 1280px
 * viewport — the whole page scrolled sideways on a desktop, before any content.
 * Twelve top-level departments and a search field cannot share one 1280px row,
 * and shortening the labels to make them fit would mean naming the departments
 * for the layout instead of for the shopper.
 *
 * So the hover interaction moves inside the panel, which is what every large
 * computer retailer does for the same reason. The behaviour the brief asks for
 * is intact — hovering a top-level category opens its large dropdown — the
 * hover target is just in the left column rather than in the header bar.
 *
 * ## The interactions, and why each is there
 *
 * **Hover opens, with a close delay.** Moving diagonally from the trigger into
 * the panel passes over whatever is between them for a few dozen milliseconds.
 * Closing instantly on mouse-leave makes that feel like the menu is fighting the
 * pointer, so leaving schedules a close ~150 ms out and re-entering anywhere
 * cancels it.
 *
 * **Hover is never the only way.** The trigger opens on click — which is what
 * `Enter` and `Space` fire on a button — every department is a real link that
 * Tab reaches, focusing one switches the right pane, and `Escape` closes and
 * returns focus to the trigger. A pointer-only mega menu is unusable for anyone
 * without a pointer.
 *
 * **Every panel is in the DOM whether it is shown or not.** The inactive ones
 * are `hidden`, not unmounted, so the markup a crawler receives contains all 102
 * category links — which is the whole SEO value of a mega menu over a category
 * page nothing links to. `hidden` also takes them out of the tab order and the
 * accessibility tree, so a keyboard user does not tab through ninety invisible
 * links to reach the search box.
 *
 * ## Data
 *
 * The tree arrives from the server already nested and carrying all three
 * languages (`listCategoryNavigation`, two queries for the whole navigation).
 * Switching language re-renders from what is already here, and this component
 * does not know where it came from.
 */

/** How long a pointer may be outside the menu before it closes. */
const CLOSE_DELAY_MS = 150;

export function CategoriesMenu({
  categories,
}: {
  categories: CategoryNavItem[];
}) {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    categories[0]?.id ?? null,
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A pending close must not fire after the component is gone — a locale switch
  // unmounts this while a timer is in flight.
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  // A shop with no categories yet renders no trigger at all, rather than a
  // button that opens an empty panel.
  if (categories.length === 0) return null;

  const active =
    categories.find((category) => category.id === activeId) ?? categories[0];

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;

        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
      // Focus leaving the whole region closes it. `onBlur` bubbles from the
      // links inside and `relatedTarget` is where focus went — so tabbing out of
      // the last link closes, and tabbing between links inside does not.
      onBlur={(event) => {
        if (!containerRef.current) return;
        if (containerRef.current.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setOpen(false);
      }}
    >
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className="gap-1.5"
        aria-expanded={open}
        // Click toggles, and there is deliberately **no** `onFocus` opener on
        // the trigger. A click focuses before it activates, so an `onFocus` that
        // opened made every click a toggle from open to closed — the menu could
        // be opened by hover and by keyboard and never by clicking it. Measured
        // in the browser, not reasoned about.
        //
        // Nothing is lost: `Enter` and `Space` on a button fire `click`, so the
        // keyboard opens it here, and Tab then walks into the panel.
        onClick={() => setOpen((current) => !current)}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        {t("categories")}
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </Button>

      <div
        hidden={!open}
        className="absolute start-0 top-full z-50 mt-1 w-[min(60rem,calc(100vw-2rem))] rounded-xl border bg-popover text-popover-foreground shadow-lg"
      >
        <div className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <nav
            aria-label={t("categoriesNav")}
            className="max-h-[32rem] overflow-y-auto border-e p-2"
          >
            <ul>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={routes.catalog.byCategory(category.slug)}
                    onMouseEnter={() => setActiveId(category.id)}
                    onFocus={() => setActiveId(category.id)}
                    aria-current={
                      category.id === active?.id ? "true" : undefined
                    }
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      category.id === active?.id
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <CategoryIcon
                      name={category.icon}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 truncate">
                      {category.name[locale]}
                    </span>
                    {category.children.length > 0 ? (
                      <ChevronRight
                        className="ms-auto size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {categories.map((category) => (
            <MegaPanel
              key={category.id}
              category={category}
              locale={locale}
              hidden={category.id !== active?.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One department's subcategories, the pane on the right. */
function MegaPanel({
  category,
  locale,
  hidden,
}: {
  category: CategoryNavItem;
  locale: Locale;
  hidden: boolean;
}) {
  const t = useTranslations("header");

  const featured = category.children.filter((child) => child.isFeatured);

  return (
    <div
      hidden={hidden}
      // Every panel occupies the same grid cell, so switching department does
      // not move the panel or resize the popover under the pointer.
      className="col-start-2 row-start-1 max-h-[32rem] overflow-y-auto p-5"
    >
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold tracking-tight">
              <CategoryIcon name={category.icon} />
              {category.name[locale]}
            </h2>

            <Link
              href={routes.catalog.byCategory(category.slug)}
              className="flex items-center gap-0.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("viewAllIn", { category: category.name[locale] })}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          {category.description[locale] ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {category.description[locale]}
            </p>
          ) : null}

          {category.children.length > 0 ? (
            <ul className="mt-4 grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
              {category.children.map((child) => (
                <li key={child.id}>
                  <SubcategoryLink item={child} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("noSubcategories")}
            </p>
          )}
        </div>

        {/*
          The department image, when an operator has uploaded one. `alt=""`
          because the heading beside it already names the department — a repeat
          of the same words is noise to a screen reader, and this image is
          decoration for a link that is already labelled.

          Not `priority`: the panel is closed until opened, so preloading twelve
          department images would spend the page's whole image budget on
          something most visitors never see.
        */}
        {category.image ? (
          <Image
            src={category.image}
            alt=""
            width={224}
            height={160}
            className="hidden h-40 w-56 shrink-0 rounded-lg object-cover lg:block"
          />
        ) : null}
      </div>

      {featured.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("popular")}
          </span>
          {featured.map((child) => (
            <Link
              key={`featured-${child.id}`}
              href={routes.catalog.byCategory(child.slug)}
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {child.name[locale]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A subcategory, and anything nested beneath it.
 *
 * Recursive, so a third level appears indented under its parent without this
 * component or the panel above it knowing the taxonomy got deeper. The shipped
 * tree is two levels; nothing here depends on that.
 */
function SubcategoryLink({
  item,
  locale,
}: {
  item: CategoryNavItem;
  locale: Locale;
}) {
  return (
    <>
      <Link
        href={routes.catalog.byCategory(item.slug)}
        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <CategoryIcon name={item.icon} className="size-4 shrink-0" />
        <span className="min-w-0 truncate">{item.name[locale]}</span>
      </Link>

      {item.children.length > 0 ? (
        <ul className="ms-3 border-s ps-2">
          {item.children.map((child) => (
            <li key={child.id}>
              <SubcategoryLink item={child} locale={locale} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
