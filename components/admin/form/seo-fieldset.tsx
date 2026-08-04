"use client";

import { useTranslations } from "next-intl";

import { FormSection } from "@/components/admin/form/form-section";
import { KeywordInput } from "@/components/admin/form/keyword-input";
import { LocalizedField } from "@/components/admin/form/localized-field";
import type { SeoFields } from "@/types/admin";

/**
 * The search-engine block, shared by products, categories, brands and pages.
 *
 * One component means the meta title and description are localized everywhere
 * or nowhere — and they are localized, because the storefront emits a
 * `hreflang` set per page and pointing three languages at one English
 * description defeats the purpose of having them.
 *
 * Keywords are deliberately not localized; see `KeywordInput`.
 */
export function SeoFieldset({
  value,
  onChange,
  disabled = false,
}: {
  value: SeoFields;
  onChange: (next: SeoFields) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("admin.seo");

  return (
    <FormSection id="seo" title={t("title")} description={t("description")}>
      <LocalizedField
        label={t("metaTitle")}
        value={value.metaTitle}
        onChange={(metaTitle) => onChange({ ...value, metaTitle })}
        disabled={disabled}
      />

      <LocalizedField
        label={t("metaDescription")}
        value={value.metaDescription}
        onChange={(metaDescription) => onChange({ ...value, metaDescription })}
        multiline
        rows={3}
        disabled={disabled}
      />

      <KeywordInput
        label={t("keywords")}
        hint={t("keywordsHint")}
        values={value.keywords}
        onChange={(keywords) => onChange({ ...value, keywords })}
        disabled={disabled}
        removeLabel={(keyword) => `${t("keywords")}: ${keyword}`}
      />
    </FormSection>
  );
}
