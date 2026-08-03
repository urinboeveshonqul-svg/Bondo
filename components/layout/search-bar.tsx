"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Catalog search.
 *
 * A real `<form>` with a submit handler rather than a keypress listener, so
 * Enter works, the mobile keyboard shows a "search" action, and the control is
 * announced as a search field.
 *
 * Submitting navigates to the listing with a `q` parameter. Type-ahead
 * suggestions need the database and land with the search service; the debounce
 * hook (`use-debounced-value`) is already in the codebase waiting for it.
 */
export function SearchBar({ className }: { className?: string }) {
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
        Search products
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
        placeholder="Search graphics cards, laptops, components…"
        className="ps-9"
        autoComplete="off"
      />
    </form>
  );
}
