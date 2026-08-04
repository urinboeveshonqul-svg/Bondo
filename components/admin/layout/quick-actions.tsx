"use client";

import { useTranslations } from "next-intl";
import { Boxes, FolderTree, Package, Plus, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * The "create something" menu in the top bar.
 *
 * Its contents are filtered on the server by permission — an inventory manager
 * has no "New product" entry, because they cannot create one. When every entry
 * is filtered out the whole control is omitted rather than rendered empty.
 */
export type QuickAction = "product" | "category" | "brand" | "stock";

const ICONS = {
  product: Package,
  category: FolderTree,
  brand: Tag,
  stock: Boxes,
} as const;

const HREFS: Record<QuickAction, string> = {
  product: routes.admin.productNew,
  category: routes.admin.categories,
  brand: routes.admin.brands,
  stock: routes.admin.inventory,
};

const LABEL_KEYS: Record<QuickAction, string> = {
  product: "newProduct",
  category: "newCategory",
  brand: "newBrand",
  stock: "adjustStock",
};

export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
  const t = useTranslations("admin.quickActions");

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">{t("label")}</span>
          <span className="sr-only sm:hidden">{t("label")}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {actions.map((action) => {
          const Icon = ICONS[action];

          return (
            <DropdownMenuItem key={action} asChild>
              <Link href={HREFS[action]}>
                <Icon aria-hidden="true" />
                {t(LABEL_KEYS[action])}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
