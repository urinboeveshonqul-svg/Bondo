"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save, Star } from "lucide-react";

import { SpecEditor } from "@/components/admin/modules/products/spec-editor";
import { VariantEditor } from "@/components/admin/modules/products/variant-editor";
import {
  ModuleForm,
  ModuleFormRow,
} from "@/components/admin/module/module-form";
import { KeywordInput } from "@/components/admin/module/keyword-input";
import { TranslationProgress } from "@/components/admin/module/module-language-tabs";
import { ModuleMediaManager } from "@/components/admin/module/module-media";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleSeoPanel } from "@/components/admin/module/module-seo-panel";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { STATE_TONE } from "@/components/admin/modules/products/publish-tone";
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
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { Locale } from "@/lib/site-config";
import type { AdminProduct } from "@/types/admin";
import type { ProductStatus, ProductVisibility } from "@/types/catalog";
import { publishState, totalStock } from "@/utils/admin";
import { formatNumber } from "@/utils/format";

/**
 * The product editor.
 *
 * One form for create and edit. A separate "new product" form is how the two
 * drift: a field added to one and forgotten in the other, and a product that
 * can only be given a warranty period after it exists.
 *
 * Every translatable field is a `LocalizedField`, so a product cannot be written
 * in one language by accident — the tab strip shows which languages are still
 * empty before it is saved. Slug, SKU and search keywords are deliberately not:
 * a slug is an address, a SKU is an identifier, and keywords are search terms
 * that cross languages.
 *
 * **Nothing persists.** There is no service to call yet, so submitting reports
 * that honestly rather than showing a success toast for work that did not
 * happen. The state shape is the product itself, so wiring a Server Action to
 * `onSubmit` is the whole of the change.
 *
 * The layout is `ModuleForm`'s, not this file's. Products declare all eight
 * canonical sections in `lib/admin/modules.ts` and fill them in here; the order
 * and the section names come from the shared vocabulary, so an operator who has
 * learned this form already knows where things are in the page editor.
 */
export function ProductForm({
  product,
  categoryOptions,
  brandOptions,
  capabilities,
}: {
  /** `null` creates a new product. */
  product: AdminProduct | null;
  categoryOptions: readonly { value: string; label: string }[];
  brandOptions: readonly { value: string; label: string }[];
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule. Creating and editing are different
  // permissions in the schema, so they are different questions here too.
  const canEdit = product ? capabilities.update : capabilities.create;
  const t = useTranslations("adminCatalog.editor");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [draft, setDraft] = useState<AdminProduct>(product ?? emptyProduct());

  const disabled = !canEdit;
  const hasVariants = draft.variants.length > 0;
  const state = publishState(draft);

  function set<K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <ModuleForm
      onSubmit={(event) => {
        event.preventDefault();
        toast(tAdmin("notSaved.title"), {
          description: tAdmin("notSaved.body"),
        });
      }}
      notice={
        disabled ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
            <ModuleStatusBadge tone="muted">
              {tAdmin("readOnly.badge")}
            </ModuleStatusBadge>
            {tAdmin("readOnly.body")}
          </p>
        ) : null
      }
      aside={
        <>
          {/*
            Coverage and publish state, kept in view while the form scrolls.
            Both are read-outs rather than controls: the switches live in the
            `publish` section, at the end, where the canonical order puts the
            decisions with consequences.
          */}
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("fields.status")}</span>
              <ModuleStatusBadge tone={STATE_TONE[state]}>
                {tAdmin(`status.${state}`)}
              </ModuleStatusBadge>
            </div>

            <TranslationProgress
              fields={[
                draft.name,
                draft.shortDescription,
                draft.description,
                draft.seo.metaTitle,
                draft.seo.metaDescription,
              ]}
            />
          </div>
        </>
      }
      actions={
        canEdit ? (
          <Button type="submit">
            <Save aria-hidden="true" />
            {tAdmin("actions.saveChanges")}
          </Button>
        ) : null
      }
      sections={{
        general: {
          children: (
            <>
              <LocalizedField
                label={t("fields.name")}
                value={draft.name}
                onChange={(name) => set("name", name)}
                disabled={disabled}
                required
              />

              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-slug">{t("fields.slug")}</Label>
                  <Input
                    id="product-slug"
                    value={draft.slug}
                    disabled={disabled}
                    onChange={(event) => set("slug", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("fields.slugHint")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-sku">{t("fields.sku")}</Label>
                  <Input
                    id="product-sku"
                    value={draft.sku}
                    disabled={disabled}
                    className="font-mono"
                    onChange={(event) => set("sku", event.target.value)}
                  />
                </div>
              </ModuleFormRow>

              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-brand">{t("fields.brand")}</Label>
                  <Select
                    value={draft.brand}
                    disabled={disabled}
                    onValueChange={(brand) => set("brand", brand)}
                  >
                    <SelectTrigger id="product-brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-category">
                    {t("fields.category")}
                  </Label>
                  <Select
                    value={draft.category}
                    disabled={disabled}
                    onValueChange={(category) => set("category", category)}
                  >
                    <SelectTrigger id="product-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
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
                onChange={(shortDescription) =>
                  set("shortDescription", shortDescription)
                }
                disabled={disabled}
                required
              />

              <LocalizedField
                label={t("fields.description")}
                value={draft.description}
                onChange={(description) => set("description", description)}
                multiline
                rows={6}
                disabled={disabled}
                required
              />
            </>
          ),
        },

        media: {
          description: t("images.description"),
          children: (
            <ModuleMediaManager
              items={draft.images}
              canUpdate={canEdit}
              onChange={(images) => set("images", images)}
            />
          ),
        },

        pricing: {
          description: hasVariants ? t("fields.stockFromVariants") : undefined,
          children: (
            <ModuleFormRow>
              <MoneyField
                id="product-price"
                label={t("fields.price")}
                cents={draft.priceCents}
                disabled={disabled || hasVariants}
                onChange={(priceCents) => set("priceCents", priceCents ?? 0)}
              />
              <MoneyField
                id="product-sale-price"
                label={t("fields.salePrice")}
                hint={t("fields.salePriceHint")}
                cents={draft.salePriceCents}
                nullable
                disabled={disabled || hasVariants}
                onChange={(salePriceCents) =>
                  set("salePriceCents", salePriceCents)
                }
              />
            </ModuleFormRow>
          ),
        },

        inventory: {
          children: (
            <div className="space-y-1.5">
              <Label htmlFor="product-stock">{t("fields.stock")}</Label>
              <Input
                id="product-stock"
                type="number"
                min={0}
                value={hasVariants ? totalStock(draft) : draft.stock}
                disabled={disabled || hasVariants}
                onChange={(event) =>
                  set("stock", Number(event.target.value) || 0)
                }
                className="tabular-nums"
              />
              {hasVariants ? (
                <p className="text-xs text-muted-foreground">
                  {t("fields.stockFromVariants")} —{" "}
                  {formatNumber(totalStock(draft), locale)}
                </p>
              ) : null}
            </div>
          ),
        },

        seo: {
          children: (
            <ModuleSeoPanel
              value={draft.seo}
              disabled={disabled}
              onChange={(seo) => set("seo", seo)}
            />
          ),
        },

        localization: {
          children: (
            <>
              {/*
                Not a second place to type a translation — every field above is
                already three-tabbed. This is the verdict: which languages are
                short, and therefore whether the product may be published at
                all (ADR-53). Same `coverageOf()` the service refuses a publish
                with, so the form and the save cannot disagree.
              */}
              <TranslationProgress
                label={t("fields.name")}
                fields={[draft.name]}
              />
              <TranslationProgress
                label={t("fields.shortDescription")}
                fields={[draft.shortDescription]}
              />
              <TranslationProgress
                label={t("fields.description")}
                fields={[draft.description]}
              />
              <TranslationProgress
                label={tAdmin("seo.metaTitle")}
                fields={[draft.seo.metaTitle]}
              />
              <TranslationProgress
                label={tAdmin("seo.metaDescription")}
                fields={[draft.seo.metaDescription]}
              />
            </>
          ),
        },

        advanced: {
          children: (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold tracking-tight">
                  {t("sections.variants")}
                </h3>
                <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                  {t("variants.description")}
                </p>
                <VariantEditor
                  options={draft.variantOptions}
                  variants={draft.variants}
                  skuPrefix={draft.sku || "SKU"}
                  disabled={disabled}
                  onOptionsChange={(variantOptions) =>
                    set("variantOptions", variantOptions)
                  }
                  onVariantsChange={(variants) => set("variants", variants)}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold tracking-tight">
                  {t("sections.specs")}
                </h3>
                <p className="max-w-prose text-sm text-pretty text-muted-foreground">
                  {t("specs.description")}
                </p>
                <SpecEditor
                  specs={draft.specs}
                  disabled={disabled}
                  onChange={(specs) => set("specs", specs)}
                />
              </div>

              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-warranty">
                    {t("fields.warranty")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="product-warranty"
                      type="number"
                      min={0}
                      value={draft.warrantyMonths}
                      disabled={disabled}
                      onChange={(event) =>
                        set("warrantyMonths", Number(event.target.value) || 0)
                      }
                      className="tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("fields.warrantyMonths")}
                    </span>
                  </div>
                </div>

                <KeywordInput
                  label={t("fields.searchKeywords")}
                  hint={t("fields.searchKeywordsHint")}
                  values={draft.searchKeywords}
                  disabled={disabled}
                  onChange={(searchKeywords) =>
                    set("searchKeywords", searchKeywords)
                  }
                  removeLabel={(keyword) =>
                    `${t("fields.searchKeywords")}: ${keyword}`
                  }
                />
              </ModuleFormRow>
            </>
          ),
        },

        publish: {
          aside: (
            <ModuleStatusBadge tone={STATE_TONE[state]}>
              {tAdmin(`status.${state}`)}
            </ModuleStatusBadge>
          ),
          children: (
            <>
              {/*
                Two controls, because the schema has two columns. "Is the work
                finished" and "should anyone see it" are separate questions, and
                collapsing them into one select is what made the interface offer
                states the database could not store (K-16).
              */}
              <ModuleFormRow>
                <div className="space-y-1.5">
                  <Label htmlFor="product-status">{t("fields.status")}</Label>
                  <Select
                    value={draft.status}
                    disabled={disabled || !capabilities.publish}
                    onValueChange={(status) =>
                      set("status", status as ProductStatus)
                    }
                  >
                    <SelectTrigger id="product-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["draft", "active", "archived"] as const).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {tAdmin(`status.${value}`)}
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
                    disabled={disabled || !capabilities.publish}
                    onValueChange={(visibility) =>
                      set("visibility", visibility as ProductVisibility)
                    }
                  >
                    <SelectTrigger id="product-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["public", "hidden"] as const).map((value) => (
                        <SelectItem key={value} value={value}>
                          {tAdmin(`visibility.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ModuleFormRow>

              <div className="space-y-1.5">
                <Label htmlFor="product-scheduled">
                  {t("fields.scheduledFor")}
                </Label>
                <Input
                  id="product-scheduled"
                  type="datetime-local"
                  value={toLocalInput(draft.scheduledFor)}
                  disabled={
                    disabled ||
                    !capabilities.publish ||
                    draft.status !== "active"
                  }
                  onChange={(event) =>
                    set(
                      "scheduledFor",
                      event.target.value
                        ? new Date(event.target.value).toISOString()
                        : null,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("fields.scheduledForHint")}
                </p>
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <Label htmlFor="product-featured" className="font-normal">
                  <Star className="size-4" aria-hidden="true" />
                  {t("fields.featured")}
                </Label>
                <Switch
                  id="product-featured"
                  checked={draft.isFeatured}
                  disabled={disabled}
                  onCheckedChange={(isFeatured) =>
                    set("isFeatured", isFeatured)
                  }
                />
              </div>
            </>
          ),
        },
      }}
    />
  );
}

function MoneyField({
  id,
  label,
  hint,
  cents,
  onChange,
  nullable = false,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  cents: number | null;
  onChange: (cents: number | null) => void;
  nullable?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={cents === null ? "" : (cents / 100).toFixed(2)}
        disabled={disabled}
        className="tabular-nums"
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") return onChange(nullable ? null : 0);
          onChange(Math.round(Number(raw) * 100));
        }}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` with no zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";

  return new Date(iso).toISOString().slice(0, 16);
}

function emptyProduct(): AdminProduct {
  const empty = { uz: "", ru: "", en: "" };

  return {
    id: "new",
    slug: "",
    sku: "",
    name: { ...empty },
    brand: "",
    category: "",
    image: "",
    imageAlt: { ...empty },
    priceCents: 0,
    salePriceCents: null,
    rating: 0,
    reviewCount: 0,
    stock: 0,
    badges: [],
    shortDescription: { ...empty },
    description: { ...empty },
    specs: [],
    warrantyMonths: 24,
    status: "draft",
    visibility: "hidden",
    isFeatured: false,
    scheduledFor: null,
    publishedAt: null,
    images: [],
    variantOptions: [],
    variants: [],
    seo: {
      slug: { ...empty },
      metaTitle: { ...empty },
      metaDescription: { ...empty },
      keywords: [],
      canonicalUrl: { ...empty },
      ogTitle: { ...empty },
      ogDescription: { ...empty },
      ogImagePath: null,
      twitterCard: null,
    },
    searchKeywords: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "",
    updatedBy: "",
  };
}
