"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { localeConfig, locales, type Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/catalog";

/**
 * One editable field, in every language the store supports.
 *
 * This is the component that makes the internationalization policy operable
 * rather than aspirational. Every translatable field in the admin uses it, so
 * "product name" is one control with three tabs instead of three fields that
 * someone remembers to fill in — and the tab strip shows at a glance which
 * languages are still empty.
 *
 * Two decisions worth stating:
 *
 * **Tabs, not three stacked inputs.** A form with 8 translatable fields becomes
 * 24 inputs stacked, and nobody scrolls past the first language. Tabs keep the
 * form the length it would be in one language and make the missing translations
 * visible as a badge rather than as blank space far below.
 *
 * **The tab strip is a real `tablist`.** Arrow keys move between languages,
 * `aria-selected` tracks the active one, and each panel is labelled by its tab.
 * Rolling this by hand with buttons and `hidden` is how a language becomes
 * unreachable by keyboard.
 *
 * Language names are rendered in their own language and carry `lang`, so a
 * screen reader pronounces "Русский" with Russian phonetics.
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  hint,
  placeholder,
  required = false,
  disabled = false,
  className,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.localized");
  const baseId = useId();
  const [active, setActive] = useState<Locale>(locales[0]);

  const missing = locales.filter((locale) => value[locale].trim() === "");
  const isComplete = missing.length === 0;

  function move(direction: 1 | -1) {
    const index = locales.indexOf(active);
    const next = (index + direction + locales.length) % locales.length;
    const target = locales[next] as Locale;

    setActive(target);
    // Focus follows selection, which is the expected behaviour for a tablist
    // whose panels are cheap to render.
    document.getElementById(`${baseId}-tab-${target}`)?.focus();
  }

  const Control = multiline ? Textarea : Input;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`${baseId}-input-${active}`}>
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>

        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            isComplete ? "text-success" : "text-muted-foreground",
          )}
        >
          {isComplete ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              {t("complete")}
            </>
          ) : (
            <>
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {t("missing", { count: missing.length })}
            </>
          )}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t("label")}
        className="flex gap-1 rounded-lg bg-muted p-1"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        {locales.map((locale) => {
          const isActive = locale === active;
          const isEmpty = value[locale].trim() === "";

          return (
            <button
              key={locale}
              type="button"
              role="tab"
              id={`${baseId}-tab-${locale}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${locale}`}
              // Only the active tab is in the tab order; arrow keys move within.
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(locale)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span lang={locale}>{localeConfig[locale].label}</span>
              {isEmpty ? (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-muted-foreground/60"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {locales.map((locale) => (
        <div
          key={locale}
          role="tabpanel"
          id={`${baseId}-panel-${locale}`}
          aria-labelledby={`${baseId}-tab-${locale}`}
          hidden={locale !== active}
        >
          <Control
            id={`${baseId}-input-${locale}`}
            lang={locale}
            value={value[locale]}
            rows={multiline ? rows : undefined}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(
              event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChange({ ...value, [locale]: event.target.value })}
          />
        </div>
      ))}

      <p className="text-xs text-muted-foreground">{hint ?? t("hint")}</p>
    </div>
  );
}
