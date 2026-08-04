"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductSpec } from "@/types/catalog";

/**
 * The specification table editor.
 *
 * Group and name are **selects over a shared vocabulary**, not free text. The
 * storefront translates them through `product.specs.*`, so a hand-typed
 * "Capacity" would render as the literal key path in Russian and Uzbek. Binding
 * the control to the vocabulary makes that impossible rather than merely
 * discouraged — and it is why "Capacity" reads identically on a memory kit, a
 * battery and an SSD.
 *
 * Values stay free text: they are figures and identifiers. `"3840 x 2160"` is
 * not translatable and does not belong in a vocabulary.
 */
const SPEC_GROUPS = [
  "general",
  "memory",
  "power",
  "connectivity",
  "cores",
  "clocks",
  "platform",
  "physical",
  "display",
  "battery",
  "switches",
  "build",
  "processor",
  "graphics",
  "storage",
  "sensor",
  "colour",
] as const;

const SPEC_NAMES = [
  "capacity",
  "type",
  "boardPower",
  "displayOutputs",
  "coreCount",
  "threadCount",
  "boostClock",
  "socket",
  "speed",
  "latency",
  "height",
  "size",
  "resolution",
  "weight",
  "refreshRate",
  "model",
  "actuation",
  "topPlate",
  "life",
  "adobeRgb",
] as const;

export function SpecEditor({
  specs,
  onChange,
  disabled = false,
}: {
  specs: readonly ProductSpec[];
  onChange: (next: ProductSpec[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.editor.specs");
  const tAdmin = useTranslations("admin");
  const tProduct = useTranslations("product.specs");

  function patch(index: number, changes: Partial<ProductSpec>) {
    onChange(
      specs.map((spec, i) => (i === index ? { ...spec, ...changes } : spec)),
    );
  }

  return (
    <div className="space-y-3">
      {specs.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {specs.map((spec, index) => {
            // The value union allows localized prose; the editor handles the
            // literal case and leaves localized values untouched, because a
            // single-line input cannot represent three languages.
            const isLocalized = typeof spec.value !== "string";

            return (
              <li
                key={`${spec.group}-${spec.name}-${index}`}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1.5fr_0.6fr_auto] sm:items-end"
              >
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`spec-group-${index}`}
                  >
                    {t("group")}
                  </label>
                  <Select
                    value={spec.group ?? "general"}
                    disabled={disabled}
                    onValueChange={(group) => patch(index, { group })}
                  >
                    <SelectTrigger id={`spec-group-${index}`} size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEC_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {tProduct(`groups.${group}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`spec-name-${index}`}
                  >
                    {t("name")}
                  </label>
                  <Select
                    value={spec.name}
                    disabled={disabled}
                    onValueChange={(name) => patch(index, { name })}
                  >
                    <SelectTrigger id={`spec-name-${index}`} size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEC_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {tProduct(`names.${name}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`spec-value-${index}`}
                  >
                    {t("value")}
                  </label>
                  <Input
                    id={`spec-value-${index}`}
                    value={isLocalized ? "" : (spec.value as string)}
                    disabled={disabled || isLocalized}
                    placeholder={
                      isLocalized ? tAdmin("localized.label") : undefined
                    }
                    onChange={(event) =>
                      patch(index, { value: event.target.value })
                    }
                    className="h-8"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`spec-unit-${index}`}
                  >
                    {t("unit")}
                  </label>
                  <Input
                    id={`spec-unit-${index}`}
                    value={spec.unit ?? ""}
                    disabled={disabled}
                    onChange={(event) =>
                      patch(index, { unit: event.target.value || null })
                    }
                    className="h-8"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={`${tAdmin("actions.remove")} — ${tProduct(`names.${spec.name}`)}`}
                  onClick={() => onChange(specs.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...specs,
            { group: "general", name: "capacity", value: "", unit: null },
          ])
        }
      >
        <Plus aria-hidden="true" />
        {t("add")}
      </Button>
    </div>
  );
}
