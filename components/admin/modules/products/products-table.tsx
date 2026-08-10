"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";

import {
  deleteProduct,
  restoreProduct,
  saveProduct,
} from "@/actions/catalog.actions";
import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { LocalizedText } from "@/types/catalog";
import type { ProductStatus, ProductVisibility } from "@/types/catalog";
import { formatDate, formatPrice } from "@/utils/format";

/**
 * The product list.
 *
 * A thin adapter over `ModuleTable`: it decides what a product column looks like
 * and nothing else. Search, filtering, sorting, pagination and selection live in
 * the table, so every module gets them without reimplementing them.
 *
 * **Every action here writes to the database.** The previous version raised a
 * "nothing was saved" toast from seven different controls — publish, unpublish,
 * feature, delete, duplicate — because there was no service call behind any of
 * them. Now each one calls a Server Action and reports what actually happened;
 * a failure shows the service's own message rather than a success the database
 * never agreed to.
 *
 * Publish and unpublish go through `saveProduct` rather than a dedicated
 * action, because publishing *is* a field change and a second write path for
 * one column is a second place for the publish rules to drift.
 */

/** A row, shaped like the query that produces it. */
export type AdminProductRow = {
  id: string;
  sku: string;
  name: LocalizedText;
  slug: LocalizedText;
  brandName: string;
  brandId: string | null;
  categoryId: string | null;
  categoryName: string;
  priceCents: number;
  salePriceCents: number | null;
  status: ProductStatus;
  visibility: ProductVisibility;
  isFeatured: boolean;
  isTranslationComplete: boolean;
  updatedAt: string;
  deletedAt: string | null;
  /** Everything `saveProduct` needs that the row does not display. */
  shortDescription: LocalizedText;
  description: LocalizedText;
  warrantyMonths: number | null;
};

export function ProductsTable({
  products,
  categoryOptions,
  brandOptions,
  capabilities,
}: {
  products: readonly AdminProductRow[];
  categoryOptions: readonly { value: string; label: string }[];
  brandOptions: readonly { value: string; label: string }[];
  capabilities: ModuleCapabilities;
}) {
  const canUpdate = capabilities.update;
  const canDelete = capabilities.delete;
  const t = useTranslations("adminCatalog.products");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /** One funnel, so no control can report a success the database did not give. */
  function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(success);
      router.refresh();
    });
  }

  /**
   * Writes one or two fields by resending the whole product.
   *
   * `saveProduct` takes the full record, so a partial change has to carry the
   * rest — which is why `AdminProductRow` holds the fields the table never
   * shows. The alternative is a patch action per column, and each one is a
   * second place for a publish rule or a validation to live.
   */
  function patch(row: AdminProductRow, changes: Partial<AdminProductRow>) {
    const next = { ...row, ...changes };

    run(
      () =>
        saveProduct({
          id: next.id,
          sku: next.sku,
          name: next.name,
          slug: next.slug,
          shortDescription: next.shortDescription,
          description: next.description,
          brandId: next.brandId,
          categoryId: next.categoryId,
          priceCents: next.priceCents,
          salePriceCents: next.salePriceCents,
          status: next.status,
          visibility: next.visibility,
          isFeatured: next.isFeatured,
          warrantyMonths: next.warrantyMonths,
        }),
      tAdmin("actions.save"),
    );
  }

  const columns: ModuleTableColumn<AdminProductRow>[] = [
    {
      id: "product",
      header: t("columns.product"),
      alwaysVisible: true,
      sortValue: (product) => product.name[locale] || product.sku,
      cell: (product) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
          >
            {(product.brandName || product.sku).slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <Link
              href={routes.admin.product(product.id)}
              className="block truncate font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {product.name[locale] || product.sku}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {product.sku}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "brand",
      header: t("columns.brand"),
      hideOnMobile: true,
      sortValue: (product) => product.brandName,
      cell: (product) => product.brandName || "—",
    },
    {
      id: "category",
      header: t("columns.category"),
      hideOnMobile: true,
      sortValue: (product) => product.categoryName,
      cell: (product) => product.categoryName || "—",
    },
    {
      id: "price",
      header: t("columns.price"),
      align: "end",
      sortValue: (product) => product.priceCents,
      cell: (product) => (
        <span className="tabular-nums">
          {formatPrice(product.salePriceCents ?? product.priceCents, locale)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      sortValue: (product) => product.status,
      cell: (product) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ModuleStatusBadge
            tone={
              product.deletedAt
                ? "warning"
                : product.status === "active" && product.visibility === "public"
                  ? "success"
                  : "muted"
            }
          >
            {tAdmin(
              `status.${product.deletedAt ? "archived" : product.status}`,
            )}
          </ModuleStatusBadge>

          {/* Surfaced in the list because it is the one thing that blocks a
              publish, and finding out inside the editor costs a round trip. */}
          {!product.isTranslationComplete ? (
            <ModuleStatusBadge tone="warning">
              {t("untranslated")}
            </ModuleStatusBadge>
          ) : null}

          {product.isFeatured ? (
            <Star
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ),
    },
    {
      id: "updated",
      header: t("columns.updated"),
      hideOnMobile: true,
      sortValue: (product) => product.updatedAt,
      cell: (product) => (
        <span className="text-muted-foreground">
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
        `${product.name[locale]} ${product.sku} ${product.brandName}`
      }
      filters={[
        {
          id: "status",
          label: t("filters.status"),
          options: (["draft", "active", "archived"] as const).map((status) => ({
            value: status,
            label: tAdmin(`status.${status}`),
          })),
          match: (product, value) => product.status === value,
        },
        {
          id: "category",
          label: t("filters.category"),
          options: categoryOptions,
          match: (product, value) => product.categoryId === value,
        },
        {
          id: "brand",
          label: t("filters.brand"),
          options: brandOptions,
          match: (product, value) => product.brandId === value,
        },
      ]}
      initialSort={{ columnId: "updated", direction: "desc" }}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      emptyAction={
        capabilities.create ? (
          <Button asChild size="sm">
            <Link href={routes.admin.productNew}>{t("new")}</Link>
          </Button>
        ) : null
      }
      searchPlaceholder={t("searchPlaceholder")}
      rowActions={(product) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              aria-label={`${tAdmin("actions.edit")} — ${product.name[locale] || product.sku}`}
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

            {canUpdate && !product.deletedAt ? (
              <>
                <DropdownMenuSeparator />

                {product.status === "active" &&
                product.visibility === "public" ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      patch(product, {
                        status: "draft",
                        visibility: "hidden",
                      })
                    }
                  >
                    {t("bulk.unpublish")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={() =>
                      patch(product, {
                        status: "active",
                        visibility: "public",
                      })
                    }
                  >
                    {t("bulk.publish")}
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onSelect={() =>
                    patch(product, { isFeatured: !product.isFeatured })
                  }
                >
                  <Star aria-hidden="true" />
                  {t("bulk.feature")}
                </DropdownMenuItem>
              </>
            ) : null}

            {product.deletedAt && canUpdate ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => restoreProduct({ id: product.id }),
                      tAdmin("actions.save"),
                    )
                  }
                >
                  <RotateCcw aria-hidden="true" />
                  {tAdmin("actions.restore")}
                </DropdownMenuItem>
              </>
            ) : null}

            {canDelete && !product.deletedAt ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (!window.confirm(t("confirmDelete"))) return;
                    run(
                      () => deleteProduct({ id: product.id }),
                      tAdmin("actions.delete"),
                    );
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  {tAdmin("actions.delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    />
  );
}
