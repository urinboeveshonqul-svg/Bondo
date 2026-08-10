"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { deleteBrand, saveBrand } from "@/actions/catalog.actions";
import { useRouter } from "@/i18n/navigation";

import {
  ModuleTable,
  type ModuleTableColumn,
} from "@/components/admin/module/module-table";
import { ModuleFormRow } from "@/components/admin/module/module-form";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { Locale } from "@/lib/site-config";

/**
 * Brand management.
 *
 * The list is the shared `ModuleTable`; editing happens in a dialog because a
 * brand is six fields and does not earn its own page. The dialog is the same
 * shadcn primitive the storefront uses, so focus trapping and Escape-to-close
 * come from one implementation.
 *
 * The brand *name* is not localized — it is a trademark, and "NVIDIA" is
 * "NVIDIA" everywhere. The description is, because it is prose the store wrote.
 */
/**
 * A row as the database has it.
 *
 * Was `Brand & { …invented fields }` built from `mocks/catalog`, with a website
 * fabricated from the slug and "featured" decided by array index. Every field
 * here is now a column.
 */
export type AdminBrandRow = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  isFeatured: boolean;
  isVisible: boolean;
  productCount: number;
};

type EditableBrand = AdminBrandRow & { monogram: string };

/**
 * A blank brand, for the create flow.
 *
 * `id: ""` rather than a generated one: `saveBrand` branches on its presence to
 * decide insert or update, and inventing a uuid client-side would make every
 * create an update of a row that does not exist.
 */
const blankBrand = (): EditableBrand => ({
  id: "",
  slug: "",
  name: "",
  websiteUrl: "",
  isFeatured: false,
  isVisible: true,
  productCount: 0,
  monogram: "",
});

/** Two letters, derived rather than stored — `brands` has no monogram column. */
const monogramOf = (name: string) => name.slice(0, 2).toUpperCase();

export function BrandsManager({
  brands,
  capabilities,
}: {
  brands: readonly AdminBrandRow[];
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule.
  const canManage = capabilities.update;
  const t = useTranslations("adminCatalog.brands");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const rows: EditableBrand[] = brands.map((brand) => ({
    ...brand,
    monogram: monogramOf(brand.name),
  }));

  const [editing, setEditing] = useState<EditableBrand | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * The list is **not** local state any more.
   *
   * It was, and every edit patched it in memory and toasted "nothing was
   * saved". Now the action writes and revalidates, and the server sends the row
   * back as fresh props — so what is on screen is what is in the database
   * rather than an optimistic guess that happened to match.
   */
  function persist(brand: EditableBrand, onDone?: () => void) {
    startTransition(async () => {
      const result = await saveBrand({
        ...(brand.id ? { id: brand.id } : {}),
        name: brand.name,
        slug: brand.slug,
        websiteUrl: brand.websiteUrl || null,
        isFeatured: brand.isFeatured,
        isVisible: brand.isVisible,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      onDone?.();
      router.refresh();
    });
  }

  function remove(brand: EditableBrand) {
    startTransition(async () => {
      const result = await deleteBrand({ id: brand.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.delete"));
      router.refresh();
    });
  }

  const columns: ModuleTableColumn<EditableBrand>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortValue: (brand) => brand.name,
      cell: (brand) => (
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
          >
            {brand.monogram}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{brand.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {t("productCount", { count: brand.productCount })}
            </span>
          </span>
        </div>
      ),
    },
    {
      id: "website",
      header: t("columns.website"),
      hideOnMobile: true,
      cell: (brand) => (
        <span className="truncate text-xs text-muted-foreground">
          {brand.websiteUrl}
        </span>
      ),
    },
    {
      id: "featured",
      header: t("columns.featured"),
      cell: (brand) =>
        brand.isFeatured ? (
          <ModuleStatusBadge tone="info">
            {tAdmin("status.featured")}
          </ModuleStatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "visibility",
      header: t("columns.visibility"),
      cell: (brand) => (
        <ModuleStatusBadge tone={brand.isVisible ? "success" : "muted"}>
          {brand.isVisible
            ? tAdmin("status.visible")
            : tAdmin("status.invisible")}
        </ModuleStatusBadge>
      ),
    },
  ];

  return (
    <>
      <ModuleTable
        rows={rows}
        columns={columns}
        getRowId={(brand) => brand.slug}
        searchIn={(brand) => `${brand.name} ${brand.slug}`}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        emptyAction={
          canManage ? (
            <Button size="sm" onClick={() => setEditing(blankBrand())}>
              {t("new")}
            </Button>
          ) : null
        }
        toolbarActions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing(blankBrand())}>
              <Plus aria-hidden="true" />
              {t("new")}
            </Button>
          ) : null
        }
        rowActions={(brand) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${tAdmin("table.rowActions")} — ${brand.name}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(brand)}>
                <Pencil aria-hidden="true" />
                {tAdmin("actions.edit")}
              </DropdownMenuItem>
              {canManage ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onSelect={() => remove(brand)}
                >
                  <Trash2 aria-hidden="true" />
                  {tAdmin("actions.delete")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>{editing.name}</DialogTitle>
                <DialogDescription>{t("subtitle")}</DialogDescription>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  persist(editing, () => setEditing(null));
                }}
              >
                <ModuleFormRow>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-name">{t("fields.name")}</Label>
                    <Input
                      id="brand-name"
                      value={editing.name}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEditing({ ...editing, name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-monogram">
                      {t("fields.monogram")}
                    </Label>
                    <Input
                      id="brand-monogram"
                      value={editing.monogram}
                      maxLength={4}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEditing({ ...editing, monogram: event.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("fields.monogramHint")}
                    </p>
                  </div>
                </ModuleFormRow>

                <ModuleFormRow>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-slug">{t("fields.slug")}</Label>
                    <Input
                      id="brand-slug"
                      value={editing.slug}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEditing({ ...editing, slug: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="brand-website">{t("fields.website")}</Label>
                    <Input
                      id="brand-website"
                      type="url"
                      value={editing.websiteUrl}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          websiteUrl: event.target.value,
                        })
                      }
                    />
                  </div>
                </ModuleFormRow>

                {/*
                  The description input was removed with the mock layer. It
                  edited a field that had no column behind it: a brand's prose
                  lives in `brand_translations`, and the dialog never sent it
                  anywhere. An input that silently discards what is typed is
                  worse than an absent one — it comes back when the dialog
                  writes translations.
                */}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <Label htmlFor="brand-featured" className="font-normal">
                      {t("fields.featured")}
                    </Label>
                    <Switch
                      id="brand-featured"
                      checked={editing.isFeatured}
                      disabled={!canManage}
                      onCheckedChange={(isFeatured) =>
                        setEditing({ ...editing, isFeatured })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <Label htmlFor="brand-visible" className="font-normal">
                      {t("fields.visible")}
                    </Label>
                    <Switch
                      id="brand-visible"
                      checked={editing.isVisible}
                      disabled={!canManage}
                      onCheckedChange={(isVisible) =>
                        setEditing({ ...editing, isVisible })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(null)}
                  >
                    {tAdmin("actions.cancel")}
                  </Button>
                  {canManage ? (
                    <Button type="submit">{tAdmin("actions.save")}</Button>
                  ) : null}
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <p className="sr-only" lang={locale}>
        {t("subtitle")}
      </p>
    </>
  );
}
