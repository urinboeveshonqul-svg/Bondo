"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import {
  ModuleLanguageTabs,
  TranslationStatus,
} from "@/components/admin/module/module-language-tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { locales, type Locale } from "@/lib/site-config";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/catalog";

/**
 * One editable field, in every language the store supports.
 *
 * This is the component that makes the internationalization policy operable
 * rather than aspirational, and since K-15 it is backed by a real schema:
 * what it edits maps one-to-one onto a `*_translations` row, and the service
 * layer does the folding. The form still holds `{ uz, ru, en }` and knows
 * nothing about how that is stored.
 *
 * Two decisions worth stating:
 *
 * **Tabs, not three stacked inputs.** A form with eight translatable fields
 * becomes twenty-four inputs stacked, and nobody scrolls past the first
 * language. Tabs keep the form the length it would be in one language and make
 * the missing translations visible as a badge rather than as blank space far
 * below.
 *
 * **Completeness comes from `coverageOf()`** — the same function the services
 * use to refuse a publish. A field that says "all languages filled in" and a
 * save that rejects it would be worse than no indicator at all.
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

        <TranslationStatus fields={[value]} />
      </div>

      <ModuleLanguageTabs
        active={active}
        onChange={setActive}
        value={value}
        idPrefix={baseId}
      />

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

/**
 * The multiline form, named for the brief's component list.
 *
 * A wrapper rather than a copy: one implementation means the tab strip, the
 * completeness badge and the keyboard handling cannot drift between the
 * single-line and multiline cases.
 */
export function LocalizedTextField(
  props: Omit<React.ComponentProps<typeof LocalizedField>, "multiline">,
) {
  return <LocalizedField {...props} multiline={false} />;
}

export function LocalizedTextarea(
  props: Omit<React.ComponentProps<typeof LocalizedField>, "multiline">,
) {
  return <LocalizedField {...props} multiline />;
}
