"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

import {
  deleteProduct,
  restoreProduct,
  saveProduct,
} from "@/actions/catalog.actions";
import { ProductImages } from "@/components/admin/modules/products/product-images";
import { SpecEditor } from "@/components/admin/modules/products/spec-editor";
import {
  ModuleForm,
  ModuleFormRow,
} from "@/components/admin/module/module-form";
import { KeywordInput } from "@/components/admin/module/keyword-input";
import { TranslationProgress } from "@/components/admin/module/module-language-tabs";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { AdminProductDraft } from "@/types/admin";
import type { ProductStatus, ProductVisibility } from "@/types/catalog";

/**
 * The product editor.
 *
 * One form for create and edit. A separate "new product" form is how the two
 * drift: a field added to one and forgotten in the other.
 *
 * ## It saves
 *
 * That is the change. The previous version held `AdminProduct` — a type built on
 * the storefront's `Product`, carrying `rating`, `stock` and `badges`, none of
 * which an administrator can write — and its `onSubmit` raised a toast saying
 * nothing had been saved. It was **D-29** exactly: a form designed against an
 * imagined schema.
 *
 * Now every field maps to a column, submitting calls `saveProduct`, and the
 * result decides what the operator is told. There is no path through this
 * component that reports success without the database confirming it.
 *
 * ## What is deliberately not here
 *
 * **Variants.** `product_variants` and `services/variants.service.ts` exist and
 * are verified, and no Server Action writes them. The old form rendered a
 * variant editor that saved nothing; showing it now would be the fake success
 * this pass exists to remove, so it is out until the actions land (**D-34**).
 *
 * **Stock.** This shop does not maintain stock levels — ADR-24 keeps quantity in
 * `inventory` behind an append-only ledger, and no screen here should write it
 * as if it were a product field.
 *
 * The layout is `ModuleForm`'s (ADR-56), so an operator who has learned the
 * category editor already knows where things are.
 */
export function ProductForm({
  product,
  categoryOptions,
  brandOptions,
  capabilities,
}: {
  /** `null` creates a new product. */
  product: AdminProductDraft | null;
  categoryOptions: readonly { value: string; label: string }[];
  brandOptions: readonly { value: string; label: string }[];
  capabilities: ModuleCapabilities;
}) {
  // Creating and editing are different permissions in the schema, so they are
  // different questions here too.
  const canEdit = product ? capabilities.update : capabilities.create;
  const t = useTranslations("adminCatalog.editor");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<AdminProductDraft>(
    product ?? emptyDraft(),
  );

  const isDeleted = draft.deletedAt !== null;
  const disabled = !canEdit || pending || isDeleted;

  function set<K extends keyof AdminProductDraft>(
    key: K,
    value: AdminProductDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /**
   * Submits and reports what actually happened.
   *
   * `startTransition` plus `disabled={pending}` is the duplicate-submit guard:
   * the button is inert for the whole round trip, so a double click cannot
   * create two products.
   */
  function submit() {
    startTransition(async () => {
      const result = await saveProduct({
        ...(draft.id ? { id: draft.id } : {}),
        sku: draft.sku,
        name: draft.name,
        slug: draft.slug,
        shortDescription: draft.shortDescription,
        description: draft.description,
        brandId: draft.brandId,
        categoryId: draft.categoryId,
        priceCents: draft.priceCents,
        salePriceCents: draft.salePriceCents,
        status: draft.status,
        visibility: draft.visibility,
        isFeatured: draft.isFeatured,
        warrantyMonths: draft.warrantyMonths,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        seoKeywords: draft.seoKeywords,
        specifications: draft.specifications,
      });

      if (!result.ok) {
        // The real message from the service — a constraint, a permission
        // refusal, a validation failure. Never a generic apology.
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));

      // A new product now has an id, so the editor stops being a "new" form —
      // without this the next Save would create a second one, and the image
      // manager would still have nothing to attach to.
      if (!draft.id) {
        router.replace(routes.admin.product(result.data.id));
        return;
      }

      router.refresh();
    });
  }

  function remove() {
    if (!draft.id) return;

    startTransition(async () => {
      const result = await deleteProduct({ id: draft.id! });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.delete"));
      router.push(routes.admin.products);
    });
  }

  function restore() {
    if (!draft.id) return;

    startTransition(async () => {
      const result = await restoreProduct({ id: draft.id! });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      router.refresh();
    });
  }

  return (
    <ModuleForm
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      notice={
        isDeleted ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <ModuleStatusBadge tone="warning">
              {tAdmin("status.archived")}
            </ModuleStatusBadge>
            {t("deletedNotice")}
          </p>
        ) : !canEdit ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <ModuleStatusBadge tone="muted">
              {tAdmin("readOnly.badge")}
            </ModuleStatusBadge>
            {tAdmin("readOnly.body")}
          </p>
        ) : null
      }
      aside={
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t("fields.status")}</span>
            <ModuleStatusBadge
              tone={draft.status === "active" ? "success" : "muted"}
            >
              {tAdmin(`status.${draft.status}`)}
            </ModuleStatusBadge>
          </div>

          <TranslationProgress
            fields={[draft.name, draft.slug, draft.shortDescription]}
          />

          {draft.updatedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("lastSaved", {
                date: new Date(draft.updatedAt).toLocaleString(locale),
              })}
            </p>
          ) : null}
        </div>
      }
      actions={
        canEdit ? (
          <div className="flex flex-wrap gap-2">
            {isDeleted ? (
              <Button type="button" disabled={pending} onClick={restore}>
                <RotateCcw aria-hidden="true" />
                {tAdmin("actions.restore")}
              </Button>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending
                  ? tAdmin("actions.saving")
                  : tAdmin("actions.saveChanges")}
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => router.push(routes.admin.products)}
            >
              {tAdmin("actions.cancel")}
            </Button>

            {draft.id && capabilities.delete && !isDeleted ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  // A soft delete is reversible, so a confirm is proportionate
                  // rather than theatre — and `restoreProduct` is the undo.
                  if (window.confirm(t("confirmDelete"))) remove();
                }}
              >
                <Trash2 aria-hidden="true" />
                {tAdmin("actions.delete")}
              </Button>
            ) : null}
          </div>
        ) : null
      }
      sections={{
        general: {
          children: (
            <div className="space-y-5">
              <LocalizedField
                label={t("fields.name")}
                value={draft.name}
                disabled={disabled}
                onChange={(name) => set("name", name)}
                required
              />

              <LocalizedField
                label={t("fields.slug")}
                hint={t("fields.slugHint")}
                value={draft.slug}
                disabled={disabled}
                onChange={(slug) => set("slug", slug)}
                required
              />

              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-sku">{t("fields.sku")}</Label>
                  <Input
                    id="product-sku"
                    value={draft.sku}
                    disabled={disabled}
                    autoComplete="off"
                    onChange={(event) => set("sku", event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-warranty">
                    {t("fields.warranty")}
                  </Label>
                  <Input
                    id="product-warranty"
                    inputMode="numeric"
                    value={draft.warrantyMonths ?? ""}
                    disabled={disabled}
                    onChange={(event) =>
                      set(
                        "warrantyMonths",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  />
                </div>
              </ModuleFormRow>

              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-category">
                    {t("fields.category")}
                  </Label>
                  <Select
                    value={draft.categoryId ?? "__none"}
                    disabled={disabled}
                    onValueChange={(value) =>
                      set("categoryId", value === "__none" ? null : value)
                    }
                  >
                    <SelectTrigger id="product-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("fields.none")}</SelectItem>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-brand">{t("fields.brand")}</Label>
                  <Select
                    value={draft.brandId ?? "__none"}
                    disabled={disabled}
                    onValueChange={(value) =>
                      set("brandId", value === "__none" ? null : value)
                    }
                  >
                    <SelectTrigger id="product-brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("fields.none")}</SelectItem>
                      {brandOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ModuleFormRow>

              <LocalizedField
                label={t("fields.shortDescription")}
                value={draft.shortDescription}
                multiline
                rows={2}
                disabled={disabled}
                onChange={(value) => set("shortDescription", value)}
              />

              <LocalizedField
                label={t("fields.description")}
                value={draft.description}
                multiline
                rows={6}
                disabled={disabled}
                onChange={(value) => set("description", value)}
              />
            </div>
          ),
        },

        media: {
          children: (
            <ProductImages
              productId={draft.id}
              images={draft.images}
              disabled={!canEdit || isDeleted}
            />
          ),
        },

        pricing: {
          children: (
            <ModuleFormRow>
              <div className="space-y-1.5">
                <Label htmlFor="product-price">{t("fields.price")}</Label>
                {/*
                  Major units in the box, minor units in the column (ADR-2). The
                  conversion is here rather than in the action so the operator
                  types what a price looks like.
                */}
                <Input
                  id="product-price"
                  inputMode="decimal"
                  value={draft.priceCents ? draft.priceCents / 100 : ""}
                  disabled={disabled}
                  onChange={(event) =>
                    set(
                      "priceCents",
                      Math.round(Number(event.target.value || 0) * 100),
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-sale-price">
                  {t("fields.salePrice")}
                </Label>
                <Input
                  id="product-sale-price"
                  inputMode="decimal"
                  value={draft.salePriceCents ? draft.salePriceCents / 100 : ""}
                  disabled={disabled}
                  onChange={(event) =>
                    set(
                      "salePriceCents",
                      event.target.value
                        ? Math.round(Number(event.target.value) * 100)
                        : null,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.salePriceHint")}
                </p>
              </div>
            </ModuleFormRow>
          ),
        },

        seo: {
          children: (
            <div className="space-y-5">
              <LocalizedField
                label={t("fields.seoTitle")}
                value={draft.seoTitle}
                disabled={disabled}
                onChange={(value) => set("seoTitle", value)}
              />
              <LocalizedField
                label={t("fields.seoDescription")}
                value={draft.seoDescription}
                multiline
                rows={3}
                disabled={disabled}
                onChange={(value) => set("seoDescription", value)}
              />
              <KeywordInput
                label={t("fields.searchKeywords")}
                hint={t("fields.searchKeywordsHint")}
                values={draft.seoKeywords}
                disabled={disabled}
                onChange={(values) => set("seoKeywords", [...values])}
                removeLabel={(keyword) =>
                  `${t("fields.searchKeywords")}: ${keyword}`
                }
              />
            </div>
          ),
        },

        advanced: {
          title: t("sections.specs"),
          children: (
            <SpecEditor
              specs={draft.specifications}
              disabled={disabled}
              onChange={(specifications) =>
                set("specifications", specifications)
              }
            />
          ),
        },

        publish: {
          children: (
            <div className="space-y-3">
              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-status">{t("fields.status")}</Label>
                  <Select
                    value={draft.status}
                    disabled={disabled}
                    onValueChange={(value) =>
                      set("status", value as ProductStatus)
                    }
                  >
                    <SelectTrigger id="product-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["draft", "active", "archived"] as const).map(
                        (status) => (
                          <SelectItem key={status} value={status}>
                            {tAdmin(`status.${status}`)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-visibility">
                    {t("fields.visibility")}
                  </Label>
                  <Select
                    value={draft.visibility}
                    disabled={disabled}
                    onValueChange={(value) =>
                      set("visibility", value as ProductVisibility)
                    }
                  >
                    <SelectTrigger id="product-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["public", "hidden"] as const).map((visibility) => (
                        <SelectItem key={visibility} value={visibility}>
                          {tAdmin(
                            `status.${visibility === "public" ? "visible" : "invisible"}`,
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ModuleFormRow>

              <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="product-featured" className="font-normal">
                    {t("fields.featured")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("fields.featuredHint")}
                  </p>
                </div>
                <Switch
                  id="product-featured"
                  checked={draft.isFeatured}
                  disabled={disabled}
                  onCheckedChange={(value) => set("isFeatured", value)}
                />
              </div>
            </div>
          ),
        },
      }}
    />
  );
}

/** A blank product. `id: null` — not the string `"new"` a uuid column would reject. */
function emptyDraft(): AdminProductDraft {
  const empty = { uz: "", ru: "", en: "" };

  return {
    id: null,
    sku: "",
    name: { ...empty },
    slug: { ...empty },
    shortDescription: { ...empty },
    description: { ...empty },
    brandId: null,
    categoryId: null,
    priceCents: 0,
    salePriceCents: null,
    warrantyMonths: null,
    // Draft and hidden, so a half-written product cannot reach the storefront by
    // being saved once.
    status: "draft",
    visibility: "hidden",
    isFeatured: false,
    seoTitle: { ...empty },
    seoDescription: { ...empty },
    seoKeywords: [],
    specifications: [],
    images: [],
    publishedAt: null,
    updatedAt: null,
    deletedAt: null,
  };
}
