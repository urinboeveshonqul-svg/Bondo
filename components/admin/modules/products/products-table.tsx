"use client";

import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";

import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { STATE_TONE } from "@/components/admin/modules/products/publish-tone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { AdminProduct } from "@/types/admin";
import { priceRange, publishState, totalStock } from "@/utils/admin";
import { formatDate, formatNumber, formatPrice } from "@/utils/format";

/**
 * The product list.
 *
 * A thin adapter over `ModuleTable`: it decides what a product column looks like
 * and nothing else. Search, filtering, sorting, pagination and selection all
 * live in the table, so the categories, brands, inventory and audit lists get
 * them for free instead of reimplementing them four more times.
 *
 * Mutating actions raise a toast saying nothing was saved rather than pretending
 * to succeed. A fake success is worse than no action: it teaches the operator
 * that a workflow works, and they find out otherwise on real data.
 */

export function ProductsTable({
  products,
  categoryOptions,
  brandOptions,
  capabilities,
}: {
  products: readonly AdminProduct[];
  categoryOptions: readonly { value: string; label: string }[];
  brandOptions: readonly { value: string; label: string }[];
  capabilities: ModuleCapabilities;
}) {
  const canUpdate = capabilities.update;
  const canDelete = capabilities.delete;
  const t = useTranslations("adminCatalog.products");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  function notSaved() {
    toast(tAdmin("notSaved.title"), { description: tAdmin("notSaved.body") });
  }

  const columns: ModuleTableColumn<AdminProduct>[] = [
    {
      id: "product",
      header: t("columns.product"),
      sortValue: (product) => product.name[locale],
      cell: (product) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
          >
            {product.brand.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <Link
              href={routes.admin.product(product.id)}
              className="block truncate font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {product.name[locale]}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {product.variants.length > 0
                ? t("variantCount", { count: product.variants.length })
                : t("noVariants")}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "sku",
      header: t("columns.sku"),
      sortValue: (product) => product.sku,
      hideOnMobile: true,
      cell: (product) => (
        <span className="font-mono text-xs">{product.sku}</span>
      ),
    },
    {
      id: "brand",
      header: t("columns.brand"),
      sortValue: (product) => product.brand,
      hideOnMobile: true,
      cell: (product) => product.brand,
    },
    {
      id: "price",
      header: t("columns.price"),
      align: "end",
      sortValue: (product) => priceRange(product).minCents,
      cell: (product) => {
        const { minCents, maxCents } = priceRange(product);

        return (
          <span className="whitespace-nowrap tabular-nums">
            {minCents === maxCents
              ? formatPrice(minCents, locale)
              : `${formatPrice(minCents, locale)} – ${formatPrice(maxCents, locale)}`}
          </span>
        );
      },
    },
    {
      id: "stock",
      header: t("columns.stock"),
      align: "end",
      sortValue: (product) => totalStock(product),
      cell: (product) => {
        const stock = totalStock(product);

        return (
          <span
            className={
              stock === 0
                ? "font-semibold text-destructive tabular-nums"
                : "tabular-nums"
            }
          >
            {formatNumber(stock, locale)}
          </span>
        );
      },
    },
    {
      id: "status",
      header: t("columns.status"),
      sortValue: (product) => publishState(product),
      cell: (product) => {
        const state = publishState(product);

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <ModuleStatusBadge tone={STATE_TONE[state]}>
              {tAdmin(`status.${state}`)}
            </ModuleStatusBadge>
            {product.isFeatured ? (
              <ModuleStatusBadge tone="info">
                {tAdmin("status.featured")}
              </ModuleStatusBadge>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "updated",
      header: t("columns.updated"),
      hideOnMobile: true,
      sortValue: (product) => product.updatedAt,
      cell: (product) => (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {formatDate(product.updatedAt, locale)}
        </span>
      ),
    },
  ];

  return (
    <ModuleTable
      rows={products}
      columns={columns}
      getRowId={(product) => product.id}
      searchIn={(product) =>
        `${product.name[locale]} ${product.sku} ${product.brand} ${product.searchKeywords.join(" ")}`
      }
      searchPlaceholder={t("searchPlaceholder")}
      initialSort={{ columnId: "updated", direction: "desc" }}
      filters={[
        {
          id: "status",
          label: t("filters.status"),
          options: (
            ["active", "draft", "hidden", "scheduled", "archived"] as const
          ).map((state) => ({
            value: state,
            label: tAdmin(`status.${state}`),
          })),
          match: (product, value) => publishState(product) === value,
        },
        {
          id: "category",
          label: t("filters.category"),
          options: categoryOptions,
          match: (product, value) => product.category === value,
        },
        {
          id: "brand",
          label: t("filters.brand"),
          options: brandOptions,
          match: (product, value) => product.brand === value,
        },
      ]}
      bulkActions={
        canUpdate
          ? [
              {
                id: "publish",
                label: t("bulk.publish"),
                onRun: notSaved,
              },
              {
                id: "unpublish",
                label: t("bulk.unpublish"),
                onRun: notSaved,
              },
              {
                id: "feature",
                label: t("bulk.feature"),
                icon: <Star aria-hidden="true" />,
                onRun: notSaved,
              },
              ...(canDelete
                ? [
                    {
                      id: "delete",
                      label: t("bulk.delete"),
                      icon: <Trash2 aria-hidden="true" />,
                      destructive: true,
                      onRun: notSaved,
                    },
                  ]
                : []),
            ]
          : []
      }
      rowActions={(product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${tAdmin("table.rowActions")} — ${product.name[locale]}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={routes.admin.product(product.id)}>
                <Pencil aria-hidden="true" />
                {tAdmin("actions.edit")}
              </Link>
            </DropdownMenuItem>
            {canUpdate ? (
              <DropdownMenuItem onSelect={notSaved}>
                <Copy aria-hidden="true" />
                {tAdmin("actions.duplicate")}
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={notSaved}>
                  <Trash2 aria-hidden="true" />
                  {tAdmin("actions.delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
    />
  );
}
