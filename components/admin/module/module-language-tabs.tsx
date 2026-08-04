"use client";

import { useTranslations } from "next-intl";
import { Check, TriangleAlert } from "lucide-react";

import { coverageOf } from "@/lib/i18n/translations";
import { localeConfig, locales, type Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/catalog";

/**
 * The translation-completeness primitives.
 *
 * All of them read the same `coverageOf()` the services use to decide whether a
 * record may be published, so what the operator sees and what the save refuses
 * can never disagree — the alternative is a form that says "complete" over a
 * service that rejects it.
 */

/** A dot per language, filled when that language has content. */
export function MissingTranslationIndicator({
  fields,
  className,
}: {
  fields: readonly (LocalizedText | null | undefined)[];
  className?: string;
}) {
  const t = useTranslations("admin.localized");
  const { missing, filled } = coverageOf(fields);

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      // The dots are decorative; the label carries the meaning.
      aria-label={
        missing.length === 0
          ? t("complete")
          : t("missing", { count: missing.length })
      }
    >
      {locales.map((locale) => (
        <span
          key={locale}
          aria-hidden="true"
          title={localeConfig[locale].label}
          className={cn(
            "size-1.5 rounded-full",
            filled.includes(locale) ? "bg-success" : "bg-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

/** A one-line verdict: complete, or how many languages are outstanding. */
export function TranslationStatus({
  fields,
  className,
}: {
  fields: readonly (LocalizedText | null | undefined)[];
  className?: string;
}) {
  const t = useTranslations("admin.localized");
  const { missing, isComplete } = coverageOf(fields);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        isComplete ? "text-success" : "text-muted-foreground",
        className,
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
  );
}

/**
 * A bar plus a count, for a whole record rather than one field.
 *
 * `role="progressbar"` carries the real numbers, because a bar with no
 * accessible value is a coloured rectangle to a screen reader.
 */
export function TranslationProgress({
  fields,
  label,
  className,
}: {
  fields: readonly (LocalizedText | null | undefined)[];
  label?: string;
  className?: string;
}) {
  const t = useTranslations("admin.localized");
  const { filled, ratio, isComplete } = coverageOf(fields);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label ?? t("label")}</span>
        <span className="font-medium tabular-nums">
          {filled.length} / {locales.length}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={locales.length}
        aria-valuenow={filled.length}
        aria-label={label ?? t("label")}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            isComplete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The tab strip on its own, for callers composing their own control.
 *
 * A real `tablist`: arrow keys move between languages, `aria-selected` tracks
 * the active one, and only the active tab is in the tab order. Rolling this by
 * hand with buttons and `hidden` is how a language becomes unreachable by
 * keyboard.
 */
export function ModuleLanguageTabs({
  active,
  onChange,
  value,
  idPrefix,
  className,
}: {
  active: Locale;
  onChange: (locale: Locale) => void;
  /** Optional — drives the "empty" dot on each tab. */
  value?: LocalizedText;
  idPrefix: string;
  className?: string;
}) {
  const t = useTranslations("admin.localized");

  function move(direction: 1 | -1) {
    const index = locales.indexOf(active);
    const next = locales[
      (index + direction + locales.length) % locales.length
    ] as Locale;

    onChange(next);
    document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className={cn("flex gap-1 rounded-lg bg-muted p-1", className)}
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
        const isEmpty = value ? value[locale].trim() === "" : false;

        return (
          <button
            key={locale}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${locale}`}
            aria-selected={isActive}
            aria-controls={`${idPrefix}-panel-${locale}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(locale)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* `lang` so a screen reader pronounces "Русский" with Russian
                phonetics rather than the page's language. */}
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
  );
}
