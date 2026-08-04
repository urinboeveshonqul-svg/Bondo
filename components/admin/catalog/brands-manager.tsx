"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  DataTable,
  type DataTableColumn,
} from "@/components/admin/data-table/data-table";
import { FormRow } from "@/components/admin/form/form-section";
import { LocalizedField } from "@/components/admin/form/localized-field";
import { StatusBadge } from "@/components/admin/shared/status-badge";
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
import type { Locale } from "@/lib/site-config";
import type { Brand, LocalizedText } from "@/types/catalog";

/**
 * Brand management.
 *
 * The list is the shared `DataTable`; editing happens in a dialog because a
 * brand is six fields and does not earn its own page. The dialog is the same
 * shadcn primitive the storefront uses, so focus trapping and Escape-to-close
 * come from one implementation.
 *
 * The brand *name* is not localized — it is a trademark, and "NVIDIA" is
 * "NVIDIA" everywhere. The description is, because it is prose the store wrote.
 */
type EditableBrand = Brand & {
  description: LocalizedText;
  website: string;
  isFeatured: boolean;
  isVisible: boolean;
};

const EMPTY: LocalizedText = { uz: "", ru: "", en: "" };

export function BrandsManager({
  brands,
  canManage,
}: {
  brands: readonly Brand[];
  canManage: boolean;
}) {
  const t = useTranslations("adminCatalog.brands");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [rows, setRows] = useState<EditableBrand[]>(() =>
    brands.map((brand, index) => ({
      ...brand,
      description: { ...EMPTY },
      website: `https://www.${brand.slug}.com`,
      isFeatured: index < 4,
      isVisible: true,
    })),
  );
  const [editing, setEditing] = useState<EditableBrand | null>(null);

  function notSaved() {
    toast(tAdmin("notSaved.title"), { description: tAdmin("notSaved.body") });
  }

  const columns: DataTableColumn<EditableBrand>[] = [
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
          {brand.website}
        </span>
      ),
    },
    {
      id: "featured",
      header: t("columns.featured"),
      cell: (brand) =>
        brand.isFeatured ? (
          <StatusBadge tone="info">{tAdmin("status.featured")}</StatusBadge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "visibility",
      header: t("columns.visibility"),
      cell: (brand) => (
        <StatusBadge tone={brand.isVisible ? "success" : "muted"}>
          {brand.isVisible
            ? tAdmin("status.visible")
            : tAdmin("status.invisible")}
        </StatusBadge>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(brand) => brand.slug}
        searchIn={(brand) => `${brand.name} ${brand.slug}`}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
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
                <DropdownMenuItem variant="destructive" onSelect={notSaved}>
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
                  setRows((current) =>
                    current.map((row) =>
                      row.slug === editing.slug ? editing : row,
                    ),
                  );
                  setEditing(null);
                  notSaved();
                }}
              >
                <FormRow>
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
                </FormRow>

                <FormRow>
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
                      value={editing.website}
                      disabled={!canManage}
                      onChange={(event) =>
                        setEditing({ ...editing, website: event.target.value })
                      }
                    />
                  </div>
                </FormRow>

                <LocalizedField
                  label={t("fields.description")}
                  value={editing.description}
                  multiline
                  rows={3}
                  disabled={!canManage}
                  onChange={(description) =>
                    setEditing({ ...editing, description })
                  }
                />

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
