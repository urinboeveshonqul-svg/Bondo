"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Boxes, CircleAlert, Receipt, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The notification bell.
 *
 * The unread count is in the button's accessible name, not only in the dot — a
 * coloured dot is invisible to a screen reader and to anyone who cannot
 * distinguish it from the icon.
 *
 * "Mark all as read" is local state here because there is nothing to persist to
 * yet. When the services land it becomes an action; the markup does not change.
 */
export type AdminNotificationItem = {
  id: string;
  kind: "low-stock" | "order" | "review" | "system";
  title: string;
  body: string;
  href: string | null;
  /** Already formatted for the locale by the server. */
  when: string;
  isRead: boolean;
};

const KIND_ICON = {
  "low-stock": Boxes,
  order: Receipt,
  review: Star,
  system: CircleAlert,
} as const;

export function AdminNotifications({
  items,
}: {
  items: readonly AdminNotificationItem[];
}) {
  const t = useTranslations("admin.notifications");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const unread = items.filter(
    (item) => !item.isRead && !readIds.has(item.id),
  ).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t("open")} — ${t("unread", { count: unread })}`}
        >
          <Bell />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
            />
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <p className="text-sm font-semibold">{t("title")}</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReadIds(new Set(items.map((i) => i.id)))}
            >
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">{t("emptyTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("emptyDescription")}
            </p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind];
              const isRead = item.isRead || readIds.has(item.id);
              const body = (
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                      isRead
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        isRead ? "font-normal" : "font-medium",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="text-xs text-pretty text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {item.when}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() =>
                        setReadIds((current) => new Set(current).add(item.id))
                      }
                      className="block px-3 py-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="px-3 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
