"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { NavIcon } from "@/components/admin/layout/nav-icon";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "@/i18n/navigation";
import type { AdminNavItem } from "@/lib/admin/navigation";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/catalog";

/**
 * Global admin search, as a command palette.
 *
 * One box that reaches everything: navigation, products, categories, brands,
 * customers, orders, pages and settings. A separate search field per screen is
 * how someone ends up on the products page looking for a customer.
 *
 * Results are supplied by the server as a flat, already-localized list. The
 * palette does not know what a product is — it knows a group, a label and a
 * destination. That keeps the mock data out of the client bundle and means
 * swapping fixtures for a real search query changes one prop.
 *
 * `Ctrl`/`Cmd` + `K` opens it, which is the convention every admin in this class
 * uses. The button stays visible and keyboard-reachable regardless: a shortcut
 * that is the only way in is not discoverable.
 */
export type AdminSearchEntry = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  icon?: string;
};

export function AdminSearch({
  navItems,
  entries,
  className,
}: {
  navItems: readonly AdminNavItem[];
  entries: readonly AdminSearchEntry[];
  className?: string;
}) {
  const t = useTranslations("admin.search");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      setOpen((current) => !current);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminSearchEntry[]>();

    for (const entry of entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }

    return [...map.entries()];
  }, [entries]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "justify-start gap-2 text-muted-foreground sm:w-56 lg:w-72",
          className,
        )}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="hidden truncate sm:inline">{t("placeholder")}</span>
        <span className="sr-only sm:hidden">{t("open")}</span>
        <CommandShortcut className="hidden lg:inline">
          {t("shortcut")}
        </CommandShortcut>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        description={t("description")}
      >
        <CommandInput placeholder={t("placeholder")} />
        <CommandList>
          <CommandEmpty>{t("empty")}</CommandEmpty>

          <CommandGroup heading={t("groups.navigation")}>
            {navItems.map((item) => (
              <CommandItem
                key={item.id}
                value={`nav ${item.id} ${item.href}`}
                onSelect={() => go(item.href)}
              >
                <NavIcon name={item.icon} />
                <NavLabel labelKey={item.labelKey} />
              </CommandItem>
            ))}
          </CommandGroup>

          {grouped.map(([group, items]) => (
            <CommandGroup key={group} heading={t(`groups.${group}`)}>
              {items.map((entry) => (
                <CommandItem
                  key={entry.id}
                  // cmdk filters on this string, so everything searchable goes in.
                  value={`${entry.label} ${entry.hint ?? ""}`}
                  onSelect={() => go(entry.href)}
                >
                  {entry.icon ? <NavIcon name={entry.icon} /> : null}
                  <span className="truncate">{entry.label}</span>
                  {entry.hint ? (
                    <span className="ms-auto truncate text-xs text-muted-foreground">
                      {entry.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

/** Nav labels are keys into the `admin` namespace; entries are already text. */
function NavLabel({ labelKey }: { labelKey: string }) {
  const t = useTranslations("admin");

  return <span className="truncate">{t(labelKey)}</span>;
}

/** Picks the active locale out of a `LocalizedText`, for callers building entries. */
export function useLocalized() {
  const locale = useLocale() as Locale;

  return (text: LocalizedText) => text[locale];
}
