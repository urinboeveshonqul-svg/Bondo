"use client";

import { useTranslations } from "next-intl";
import { Store } from "lucide-react";

import { NavIcon } from "@/components/admin/layout/nav-icon";
import { Link, usePathname } from "@/i18n/navigation";
import type { AdminNavSection } from "@/lib/admin/navigation";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/**
 * The admin sidebar.
 *
 * It receives an **already filtered** section list. Permission checks happen
 * once, on the server, in the layout — doing them here would mean shipping the
 * permission model to the browser and inviting a second, divergent copy of the
 * rule. What arrives is simply the list this person may see.
 *
 * `usePathname` comes from `@/i18n/navigation`, so it returns the route without
 * its locale prefix and matches the unprefixed hrefs in the nav tree directly.
 */
export function AdminSidebar({
  sections,
  collapsed = false,
  onNavigate,
  className,
}: {
  sections: readonly AdminNavSection[];
  collapsed?: boolean;
  /** Called after a link is chosen, so the mobile drawer can close itself. */
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col gap-4", className)}>
      <Link
        href={routes.admin.index}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Store className="size-4" aria-hidden="true" />
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight">
              {siteConfig.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {t("title")}
            </span>
          </span>
        ) : null}
      </Link>

      <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto">
        <ul className="space-y-5">
          {sections.map((section) => (
            <li key={section.id}>
              {/* The heading is hidden when collapsed rather than removed, so
                  the groups keep their names in the accessibility tree. */}
              <p
                className={cn(
                  "mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                  collapsed && "sr-only",
                )}
              >
                {t(section.labelKey)}
              </p>

              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== routes.admin.index &&
                      pathname.startsWith(`${item.href}/`));

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={isActive ? "page" : undefined}
                        title={collapsed ? t(item.labelKey) : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          collapsed && "justify-center",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <NavIcon name={item.icon} />
                        <span
                          className={cn("truncate", collapsed && "sr-only")}
                        >
                          {t(item.labelKey)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        href={routes.home}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          collapsed && "justify-center",
        )}
      >
        <Store className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn("truncate", collapsed && "sr-only")}>
          {t("backToStore")}
        </span>
      </Link>
    </div>
  );
}
