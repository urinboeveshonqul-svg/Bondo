"use client";

import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";

import {
  CATEGORY_ICONS,
  CATEGORY_ICON_NAMES,
} from "@/components/layout/category-icon";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The category icon picker.
 *
 * A grid of the glyphs the storefront can actually draw, rendered from
 * `CATEGORY_ICONS` itself rather than from a copy of its keys — so an operator
 * cannot pick something the header would fail to render, and adding a glyph is
 * one edit in one file (ADR-69, extended to categories by ADR-72).
 *
 * A grid rather than a `<Select>` because the thing being chosen is a picture.
 * A dropdown listing "PcCase", "Gamepad2", "MemoryStick" asks the operator to
 * translate identifiers into images in their head, which is exactly the work the
 * picker exists to remove.
 *
 * **"No icon" is the first option, not the absence of a choice.** Most
 * categories have none — ninety of the ninety-nine shipped subcategories — so
 * clearing one has to be a control, not a trick.
 *
 * Radio semantics, so arrow keys move between glyphs and a screen reader
 * announces "3 of 30" rather than reading thirty buttons.
 */
export function CategoryIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("adminCatalog.categories");

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Label asChild>
        <legend>{t("fields.icon")}</legend>
      </Label>

      {/*
        Roving tabindex needs the arrow keys wired up, or the untabbable options
        become unreachable rather than merely skipped — a worse outcome than not
        using radio semantics at all. `null` is index 0, so the option list here
        is deliberately one longer than the icon list.
      */}
      <div
        role="radiogroup"
        aria-label={t("fields.icon")}
        className="flex flex-wrap gap-1.5"
        onKeyDown={(event) => {
          const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
          if (!keys.includes(event.key) || disabled) return;

          event.preventDefault();

          const options: (string | null)[] = [null, ...CATEGORY_ICON_NAMES];
          const current = options.indexOf(value);
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
          const next = (current + step + options.length) % options.length;

          onChange(options[next] ?? null);

          // Selection follows focus in a radiogroup, so focus has to follow it
          // back — otherwise the arrow key changes the value and leaves the ring
          // on the option the operator has just moved away from.
          const group = event.currentTarget;
          requestAnimationFrame(() => {
            group.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
          });
        }}
      >
        <IconOption
          label={t("fields.noIcon")}
          selected={value === null}
          disabled={disabled}
          onSelect={() => onChange(null)}
        >
          <Ban className="size-5" aria-hidden="true" />
        </IconOption>

        {CATEGORY_ICON_NAMES.map((name) => {
          const Icon = CATEGORY_ICONS[name];
          if (!Icon) return null;

          return (
            <IconOption
              key={name}
              // The identifier is the accessible name because it is the only
              // name this glyph has. Translating thirty icon labels would be
              // thirty strings per language describing pictures the operator can
              // already see.
              label={name}
              selected={value === name}
              disabled={disabled}
              onSelect={() => onChange(name)}
            >
              <Icon className="size-5" aria-hidden="true" />
            </IconOption>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t("fields.iconHint")}</p>
    </fieldset>
  );
}

function IconOption({
  label,
  selected,
  disabled,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      // Only the selected option is tabbable, so Tab moves past the whole group
      // and the arrow keys move within it — the roving tabindex a radiogroup is
      // expected to have.
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex size-11 items-center justify-center rounded-lg border transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted",
        disabled && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}
