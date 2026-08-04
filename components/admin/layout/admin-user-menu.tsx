"use client";

import { useTranslations } from "next-intl";
import { LogOut, UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The signed-in administrator's menu.
 *
 * Profile and sign-out are `disabled` rather than absent: both need Supabase
 * Auth, which does not exist yet (**K-2**), and rendering them as links would
 * put two dead ends in the header. Disabled with a visible reason is the honest
 * state — the same call the storefront header makes for its account control.
 */
export function AdminUserMenu({
  name,
  email,
  initials,
  roleLabel,
}: {
  name: string;
  email: string;
  initials: string;
  roleLabel: string;
}) {
  const t = useTranslations("admin.userMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${t("open")} — ${name}`}
        >
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">
            {t("signedInAs")}
          </span>
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {email}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <UserRound aria-hidden="true" />
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
