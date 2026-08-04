"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { Category } from "@/types/catalog";

/**
 * Categories dropdown.
 *
 * Client-side because the menu needs focus management and roving keyboard
 * navigation — Radix provides both, including Escape to close and returning
 * focus to the trigger, which a hand-rolled `<details>` does not.
 *
 * The categories themselves are passed in from the server carrying all three
 * languages, so switching language does not refetch and this component does not
 * care where the data came from.
 */
export function CategoriesMenu({ categories }: { categories: Category[] }) {
  const t = useTranslations("header");
  const locale = useLocale() as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          {t("categories")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {categories.map((category) => (
          <DropdownMenuItem key={category.slug} asChild>
            <Link
              href={routes.catalog.byCategory(category.slug)}
              className="flex-col items-start gap-0.5"
            >
              <span className="font-medium">{category.name[locale]}</span>
              <span className="text-xs text-muted-foreground">
                {category.description[locale]}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
