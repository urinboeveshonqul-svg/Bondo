"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/lib/routes";
import type { Category } from "@/types/catalog";

/**
 * Categories dropdown.
 *
 * Client-side because the menu needs focus management and roving keyboard
 * navigation — Radix provides both, including Escape to close and returning
 * focus to the trigger, which a hand-rolled `<details>` does not.
 *
 * The categories themselves are passed in from the server, so the list is not
 * fetched on the client and the component does not care where it came from.
 */
export function CategoriesMenu({ categories }: { categories: Category[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          Categories
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
              <span className="font-medium">{category.name}</span>
              <span className="text-xs text-muted-foreground">
                {category.description}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
