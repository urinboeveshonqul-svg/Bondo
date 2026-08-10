"use client";

import { useTranslations } from "next-intl";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminProductSpec } from "@/types/admin";

/**
 * The specifications table for one product.
 *
 * ## Free text, because the column is free text
 *
 * This used to render `ProductSpec`, whose `group` and `name` are **translation
 * keys** into the `product` namespace — a design that works for a fixed
 * vocabulary in a fixture and cannot express what `product_specifications`
 * actually stores, which is free text an operator types per row. A GPU's
 * "Boost clock" and a keyboard's "Switch type" are not a shared vocabulary, and
 * the schema said so from the start: the column is `text` and the table comment
 * explains that the useful attributes of a GPU and a keyboard have nothing in
 * common.
 *
 * So the editor writes what the table holds: `spec_group`, `name`, `value`,
 * `unit`. Nothing here is a key, and nothing needs a translation file entry
 * before an operator can use it.
 *
 * ## Not localized, and that is a decision
 *
 * "24", "GDDR6X", "AM5", "3840 x 2160" are identifiers and measurements that
 * read the same in every language, and the value column is one `text` field per
 * row. A product whose specs genuinely need prose in three languages is one this
 * table cannot serve, and the honest place to fix that is the schema — not a
 * form that pretends the column is localized. Recorded as **D-33**.
 *
 * Order is the array order, written to `display_order` on save.
 */
export function SpecEditor({
  specs,
  onChange,
  disabled = false,
}: {
  specs: readonly AdminProductSpec[];
  onChange: (next: AdminProductSpec[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.editor.specs");
  const tAdmin = useTranslations("admin.actions");

  function patch(index: number, changes: Partial<AdminProductSpec>) {
    onChange(
      specs.map((spec, i) => (i === index ? { ...spec, ...changes } : spec)),
    );
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= specs.length) return;

    const next = [...specs];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange(next);
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
          {specs.map((spec, index) => (
            <li
              key={index}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_6rem_auto] sm:items-end"
            >
              <span
                aria-hidden="true"
                className="hidden self-center text-muted-foreground sm:block"
              >
                <GripVertical className="size-4" />
              </span>

              <div className="space-y-1">
                <Label
                  htmlFor={`spec-name-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {t("name")}
                </Label>
                <Input
                  id={`spec-name-${index}`}
                  value={spec.name}
                  disabled={disabled}
                  onChange={(event) =>
                    patch(index, { name: event.target.value })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor={`spec-value-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {t("value")}
                </Label>
                <Input
                  id={`spec-value-${index}`}
                  value={spec.value}
                  disabled={disabled}
                  onChange={(event) =>
                    patch(index, { value: event.target.value })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor={`spec-unit-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {t("unit")}
                </Label>
                <Input
                  id={`spec-unit-${index}`}
                  value={spec.unit ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    patch(index, { unit: event.target.value || null })
                  }
                  className="h-9"
                />
              </div>

              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={`${tAdmin("moveUp")} — ${spec.name || index + 1}`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === specs.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`${tAdmin("moveDown")} — ${spec.name || index + 1}`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onChange(specs.filter((_, i) => i !== index))}
                  aria-label={`${tAdmin("remove")} — ${spec.name || index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>

              {/* The group spans the row beneath, because it is optional and
                  most products never set one. */}
              <div className="space-y-1 sm:col-span-5 sm:col-start-2">
                <Label
                  htmlFor={`spec-group-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {t("group")}
                </Label>
                <Input
                  id={`spec-group-${index}`}
                  value={spec.group ?? ""}
                  disabled={disabled}
                  placeholder={t("groupPlaceholder")}
                  onChange={(event) =>
                    patch(index, { group: event.target.value || null })
                  }
                  className="h-9"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!disabled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...specs,
              { group: null, name: "", value: "", unit: null },
            ])
          }
        >
          <Plus aria-hidden="true" />
          {t("add")}
        </Button>
      ) : null}
    </div>
  );
}
