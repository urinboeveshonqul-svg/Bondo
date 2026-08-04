"use client";

import { useTranslations } from "next-intl";
import {
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Link, usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The account sidebar.
 *
 * Client-side only because it needs the current pathname to mark the active
 * link. `usePathname` comes from `@/i18n/navigation`, so it returns the path
 * **without** the locale prefix and compares cleanly against `routes` — the
 * unprefixed comparison is the whole reason those constants carry no locale.
 *
 * `aria-current="page"` rather than colour alone: the active item has to be
 * identifiable without seeing it.
 *
 * Orders and addresses are deliberately absent. Neither route exists yet — the
 * `orders` table arrives with checkout — and this codebase does not ship links
 * to pages that 404.
 *
 * ## The admin entry
 *
 * Rendered only for an active administrator, and **`isAdmin` is decided on the
 * server** by the layout's guard, which had already resolved it for this
 * request. Nothing here is a permission check: the link is a shortcut, and
 * `requireAdmin()` plus RLS decide what actually opens.
 *
 * It lives here rather than in the site header on purpose. The header renders on
 * every page of the storefront, so putting the admin link there would mean
 * asking "who is this and are they staff" on every product view, for every
 * visitor — a GoTrue round trip and two queries that ADR-11 exists to avoid.
 * The account page already knows the answer, and it is where somebody looks for
 * their own tools.
 */
const ITEMS = [
  { href: routes.account.index, key: "overview", Icon: LayoutDashboard },
  { href: routes.account.profile, key: "profile", Icon: UserRound },
  { href: routes.account.security, key: "security", Icon: KeyRound },
] as const;

export function AccountNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const t = useTranslations("account.nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map(({ href, key, Icon }) => {
          const isActive = pathname === href;

          return (
            <li key={key} className="shrink-0 lg:shrink">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}

        {isAdmin ? (
          <li className="shrink-0 lg:mt-2 lg:shrink lg:border-t lg:pt-2">
            <Link
              href={routes.admin.index}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              {t("admin")}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
