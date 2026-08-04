"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { ProductVariant, VariantOption } from "@/types/catalog";
import { optionCombinations } from "@/utils/admin";

/**
 * The variant matrix.
 *
 * Two halves that have to stay consistent: the **axes** a product varies on
 * (memory, storage, graphics) and the **rows** actually sold. Generating rows
 * from the axes is the only sane way to author them — typing four SKUs by hand
 * for a 2×2 laptop is where a missing configuration comes from.
 *
 * Generation is explicit rather than automatic on every axis edit. Adding a
 * third value to an axis would otherwise silently wipe prices and stock that
 * were already entered on existing rows, and the operator would not see it
 * happen. `mergeGenerated` keeps every row whose combination still exists.
 *
 * The row cap is a real guard, not a nicety: three axes with five values each is
 * 125 SKUs, which is a mistake rather than a catalog.
 */
const MAX_VARIANTS = 60;

export function VariantEditor({
  options,
  variants,
  onOptionsChange,
  onVariantsChange,
  skuPrefix,
  disabled = false,
}: {
  options: readonly VariantOption[];
  variants: readonly ProductVariant[];
  onOptionsChange: (next: VariantOption[]) => void;
  onVariantsChange: (next: ProductVariant[]) => void;
  /** Seeds generated SKUs, so they read as siblings of the parent product. */
  skuPrefix: string;
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.editor.variants");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [draftName, setDraftName] = useState("");
  const [draftValues, setDraftValues] = useState("");

  const combinations = optionCombinations(
    options.map((option) => ({ key: option.key, values: option.values })),
  );
  const wouldCreate = options.length === 0 ? 0 : combinations.length;

  function addOption() {
    const name = draftName.trim();
    const values = draftValues
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!name || values.length === 0) return;

    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    onOptionsChange([
      ...options,
      // The axis name is localized like every other label; the draft supplies
      // the same text to all three so it is never blank, and the operator
      // refines it per language afterwards.
      { key, name: { uz: name, ru: name, en: name }, values },
    ]);

    setDraftName("");
    setDraftValues("");
  }

  function generate() {
    if (wouldCreate === 0 || wouldCreate > MAX_VARIANTS) return;

    const existing = new Map(
      variants.map((variant) => [signature(variant.options), variant]),
    );

    onVariantsChange(
      combinations.map((combination, index) => {
        const kept = existing.get(signature(combination));
        if (kept) return kept;

        return {
          id: `v-new-${index}-${signature(combination)}`,
          sku: `${skuPrefix}-${Object.values(combination).join("-").toUpperCase()}`,
          options: combination,
          priceCents: 0,
          salePriceCents: null,
          stock: 0,
          weightGrams: 0,
          imagePath: null,
          isActive: true,
        };
      }),
    );
  }

  function patch(id: string, changes: Partial<ProductVariant>) {
    onVariantsChange(
      variants.map((variant) =>
        variant.id === id ? { ...variant, ...changes } : variant,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {options.length > 0 ? (
          <ul className="space-y-2">
            {options.map((option) => (
              <li
                key={option.key}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {option.name[locale]}
                </span>
                <span className="flex flex-wrap gap-1">
                  {option.values.map((value) => (
                    <span
                      key={value}
                      className="rounded-full border bg-background px-2 py-0.5 text-xs"
                    >
                      {value}
                    </span>
                  ))}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ms-auto"
                  disabled={disabled}
                  onClick={() =>
                    onOptionsChange(options.filter((o) => o.key !== option.key))
                  }
                  aria-label={`${tAdmin("actions.remove")} — ${option.name[locale]}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="variant-option-name">{t("optionName")}</Label>
            <Input
              id="variant-option-name"
              value={draftName}
              disabled={disabled}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="variant-option-values">{t("optionValues")}</Label>
            <Input
              id="variant-option-values"
              value={draftValues}
              disabled={disabled}
              placeholder="16GB, 32GB"
              onChange={(event) => setDraftValues(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOption();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addOption}
            disabled={disabled || !draftName.trim() || !draftValues.trim()}
          >
            <Plus aria-hidden="true" />
            {t("addOption")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t("optionValuesHint")}</p>
      </div>

      {options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generate}
            disabled={
              disabled || wouldCreate === 0 || wouldCreate > MAX_VARIANTS
            }
          >
            <Wand2 aria-hidden="true" />
            {t("generate")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {wouldCreate > MAX_VARIANTS
              ? t("tooMany", { count: wouldCreate })
              : t("generateHint", { count: wouldCreate })}
          </p>
        </div>
      ) : null}

      {variants.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("columns.variant")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("columns.sku")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.price")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.salePrice")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.stock")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.weight")}
                </th>
                <th scope="col" className="px-3 py-2 text-center font-medium">
                  {t("columns.active")}
                </th>
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">{tAdmin("actions.remove")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((variant) => {
                const label = Object.values(variant.options).join(" / ");

                return (
                  <tr
                    key={variant.id}
                    className={cn(!variant.isActive && "opacity-60")}
                  >
                    <th
                      scope="row"
                      className="px-3 py-2 text-start font-medium"
                    >
                      {label}
                    </th>
                    <td className="px-3 py-2">
                      <Input
                        value={variant.sku}
                        disabled={disabled}
                        aria-label={`${t("columns.sku")} — ${label}`}
                        onChange={(event) =>
                          patch(variant.id, { sku: event.target.value })
                        }
                        className="h-8 min-w-36 font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MinorUnitsInput
                        label={`${t("columns.price")} — ${label}`}
                        cents={variant.priceCents}
                        disabled={disabled}
                        // Not nullable here, so the callback never yields null —
                        // the coalesce is what tells the type system that.
                        onChange={(priceCents) =>
                          patch(variant.id, { priceCents: priceCents ?? 0 })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MinorUnitsInput
                        label={`${t("columns.salePrice")} — ${label}`}
                        cents={variant.salePriceCents}
                        nullable
                        disabled={disabled}
                        onChange={(salePriceCents) =>
                          patch(variant.id, { salePriceCents })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={variant.stock}
                        disabled={disabled}
                        aria-label={`${t("columns.stock")} — ${label}`}
                        onChange={(event) =>
                          patch(variant.id, {
                            stock: Number(event.target.value) || 0,
                          })
                        }
                        className="h-8 w-20 text-end tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={variant.weightGrams}
                          disabled={disabled}
                          aria-label={`${t("columns.weight")} — ${label}`}
                          onChange={(event) =>
                            patch(variant.id, {
                              weightGrams: Number(event.target.value) || 0,
                            })
                          }
                          className="h-8 w-24 text-end tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground">
                          {t("weightGrams")}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Switch
                        checked={variant.isActive}
                        disabled={disabled}
                        aria-label={`${t("columns.active")} — ${label}`}
                        onCheckedChange={(isActive) =>
                          patch(variant.id, { isActive })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={`${tAdmin("actions.remove")} — ${label}`}
                        onClick={() =>
                          onVariantsChange(
                            variants.filter((v) => v.id !== variant.id),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Order-independent key for an option combination. */
function signature(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((key) => `${key}:${options[key]}`)
    .join("|");
}

/**
 * Money entered as a decimal, stored as integer minor units (ADR-2).
 *
 * The conversion happens at the edge of the form so nothing downstream ever
 * holds a float — which is the entire point of storing cents.
 */
function MinorUnitsInput({
  label,
  cents,
  onChange,
  nullable = false,
  disabled = false,
}: {
  label: string;
  cents: number | null;
  onChange: (cents: number | null) => void;
  nullable?: boolean;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      value={cents === null ? "" : (cents / 100).toFixed(2)}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") return onChange(nullable ? null : 0);
        onChange(Math.round(Number(raw) * 100));
      }}
      className="h-8 w-28 text-end tabular-nums"
    />
  );
}
