"use client";

import { useTranslations } from "next-intl";

import { KeywordInput } from "@/components/admin/module/keyword-input";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Constants } from "@/types/database";
import type { SeoFields } from "@/types/admin";

/**
 * The search-engine and social block, shared by products, categories, brands and
 * pages. There is no second one.
 *
 * ## Everything a crawler reads is localized
 *
 * Slug, meta title, meta description, canonical and the Open Graph copy are all
 * `LocalizedText`, because the storefront emits an `hreflang` set per page
 * (ADR-40) and pointing three languages at one English description defeats the
 * purpose of having them. The schema agrees: since `20260804001000` and
 * `20260805001000` every one of these is a column on the **translation** row,
 * not the parent.
 *
 * Keywords are the exception and are deliberately not localized — see
 * `KeywordInput`.
 *
 * ## The fallback chain
 *
 * Empty fields are not missing data. The storefront resolves
 *
 *     twitter:title → og_title → seo_title → the record's name
 *
 * and the same for descriptions, so a store that fills in nothing here still
 * emits complete cards. That is why the labels say "falls back to" rather than
 * marking anything required, and it is why Open Graph has no separate Twitter
 * copy: two fields holding the same sentence drift, and the drift is invisible
 * until someone shares a link.
 *
 * ## The card type is one value, not three
 *
 * `twitter_card` and the share image are stored per locale like everything else,
 * but this panel writes one value to all three. A large-image card in English
 * and a small one in Russian is not a translation, it is an inconsistency, and
 * offering the choice per language invites it. The service writes the same value
 * to each translation row; the column stays per-locale so the day a store needs
 * the distinction, the schema already allows it.
 *
 * The card options come from `Constants.public.Enums.twitter_card` — the
 * generated enum, not a hand-written union (CLAUDE.md § 12), so a select can
 * never offer a value the insert rejects.
 */
export function ModuleSeoPanel({
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
    // Fields only, no frame. `ModuleForm` supplies the `seo` section around
    // this, so the panel cannot end up double-boxed inside one form and
    // unboxed inside another.
    <div className="space-y-5">
      {value.slug ? (
        <LocalizedField
          label={t("slug")}
          hint={t("slugHint")}
          value={value.slug}
          onChange={(slug) => onChange({ ...value, slug })}
          disabled={disabled}
        />
      ) : null}

      <LocalizedField
        label={t("metaTitle")}
        hint={t("metaTitleHint")}
        value={value.metaTitle}
        onChange={(metaTitle) => onChange({ ...value, metaTitle })}
        disabled={disabled}
      />

      <LocalizedField
        label={t("metaDescription")}
        hint={t("metaDescriptionHint")}
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

      <LocalizedField
        label={t("canonical")}
        hint={t("canonicalHint")}
        value={value.canonicalUrl}
        onChange={(canonicalUrl) => onChange({ ...value, canonicalUrl })}
        placeholder="https://"
        disabled={disabled}
      />

      <Separator />

      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-tight">{t("social")}</h3>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {t("socialDescription")}
        </p>
      </div>

      <LocalizedField
        label={t("ogTitle")}
        hint={t("ogTitleHint")}
        value={value.ogTitle}
        onChange={(ogTitle) => onChange({ ...value, ogTitle })}
        disabled={disabled}
      />

      <LocalizedField
        label={t("ogDescription")}
        hint={t("ogDescriptionHint")}
        value={value.ogDescription}
        onChange={(ogDescription) => onChange({ ...value, ogDescription })}
        multiline
        rows={3}
        disabled={disabled}
      />

      <div className="space-y-2">
        <Label htmlFor="seo-og-image">{t("ogImage")}</Label>
        {/*
          A storage object path, not a URL — the convention every other image
          column uses. A URL would bake the project reference into the row and
          break on a restore into a different project.
        */}
        <Input
          id="seo-og-image"
          value={value.ogImagePath ?? ""}
          onChange={(event) =>
            onChange({ ...value, ogImagePath: event.target.value || null })
          }
          placeholder="products/<id>/social.jpg"
          disabled={disabled}
          autoComplete="off"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">{t("ogImageHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seo-twitter-card">{t("twitterCard")}</Label>
        <Select
          value={value.twitterCard ?? "__default"}
          disabled={disabled}
          onValueChange={(next) =>
            onChange({
              ...value,
              twitterCard:
                next === "__default"
                  ? null
                  : (next as SeoFields["twitterCard"]),
            })
          }
        >
          <SelectTrigger id="seo-twitter-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default">{t("cards.default")}</SelectItem>
            {Constants.public.Enums.twitter_card.map((card) => (
              <SelectItem key={card} value={card}>
                {t(`cards.${card}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("twitterCardHint")}</p>
      </div>
    </div>
  );
}
