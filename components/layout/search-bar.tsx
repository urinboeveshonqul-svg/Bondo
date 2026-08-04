"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Catalog search.
 *
 * A real `<form>` with a submit handler rather than a keypress listener, so
 * Enter works, the mobile keyboard shows a "search" action, and the control is
 * announced as a search field.
 *
 * Submitting navigates to the listing with a `q` parameter. The router comes
 * from `@/i18n/navigation`, so the search stays in the visitor's language —
 * `next/navigation`'s router would push an unprefixed path and bounce them to
 * the default locale mid-search.
 *
 * Type-ahead suggestions need the database and land with the search service;
 * the debounce hook (`use-debounced-value`) is already in the codebase waiting
 * for it.
 */
export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations("header.search");
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      className={cn("relative w-full", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        router.push(`${routes.catalog.index}?q=${encodeURIComponent(trimmed)}`);
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        {t("label")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("placeholder")}
        className="ps-9"
        autoComplete="off"
      />
    </form>
  );
}
