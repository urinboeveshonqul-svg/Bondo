"use client";

import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  buildCatalogHref,
  clearCatalogFilters,
  hasActiveFilters,
  toggleBrand,
  withCatalogQuery,
  type CatalogQuery,
} from "@/lib/catalog/search-params";
import type { Locale } from "@/lib/site-config";
import { formatPrice } from "@/utils/format";

/**
 * Product filters — price, brand, discounts.
 *
 * **Filters are not categories.** That separation is the point of this
 * component: the category rows above navigate the taxonomy, and these narrow the
 * result within it. They do not look alike, they do not sit together, and
 * clearing filters does not clear the category.
 *
 * ## Only filters with a real column behind them
 *
 * Three, and each maps to something the database actually stores:
 *
 * | Filter    | Column                                      |
 * | --------- | ------------------------------------------- |
 * | Price     | `products.price_cents`                      |
 * | Brand     | `products.brand_id`                         |
 * | On sale   | `products.sale_price_cents is not null`     |
 *
 * **Availability is deliberately absent.** `inventory` exists, but this shop
 * does not maintain stock levels — the low-stock badge was removed for the same
 * reason — so an "in stock" checkbox would filter on a number nobody updates.
 * **Specification facets are absent too:** `product_specifications` is free-text
 * key/value, so faceting it would mean guessing which keys are worth offering
 * and rendering whatever an editor happened to type.
 *
 * ## A client component, and only this much of one
 *
 * The listing stays a Server Component. This is the interactive island: it holds
 * the two price inputs while they are being typed and turns every change into a
 * navigation, because the URL is the filter state (`lib/catalog/search-params`).
 *
 * Brand and sale changes navigate immediately — a checkbox that needs a second
 * "apply" click is one shoppers tick and then wonder about. Price applies on
 * submit, because a range is not meaningful half-typed.
 */
export function CatalogFilters({
  query,
  brands,
  priceRange,
  onNavigate,
}: {
  query: CatalogQuery;
  brands: { slug: string; name: string; productCount: number }[];
  priceRange: { min: number; max: number } | null;
  /** Lets the mobile sheet close itself when a filter is applied. */
  onNavigate?: () => void;
}) {
  const t = useTranslations("catalog.filters");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * This panel is rendered **twice** — inline in the desktop sidebar and inside
   * the mobile sheet — so every id has to be scoped to the instance.
   *
   * Without it both copies emitted `filter-min`, `filter-sale` and one id per
   * brand, and `<Label htmlFor>` resolves to the **first** match in the
   * document: a label tapped inside the drawer toggled the checkbox behind it in
   * the sidebar. Duplicate ids are also an accessibility defect in their own
   * right. Caught by reading the rendered DOM, not by review.
   */
  const uid = useId();

  const [min, setMin] = useState(query.minPrice?.toString() ?? "");
  const [max, setMax] = useState(query.maxPrice?.toString() ?? "");

  function go(next: CatalogQuery) {
    startTransition(() => {
      router.push(buildCatalogHref(next));
      onNavigate?.();
    });
  }

  /** An empty box means "no bound", which is different from zero. */
  const bound = (value: string) => {
    const parsed = Number(value.replace(/\s/g, ""));
    return value.trim() && Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : undefined;
  };

  const showClear = hasActiveFilters(query);

  return (
    <div className="space-y-5">
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          go(
            withCatalogQuery(query, {
              minPrice: bound(min),
              maxPrice: bound(max),
            }),
          );
        }}
      >
        <fieldset className="space-y-2.5" disabled={pending}>
          <legend className="text-sm font-medium">{t("price")}</legend>

          <div className="flex items-center gap-2">
            <Label htmlFor={`${uid}-min`} className="sr-only">
              {t("priceMin")}
            </Label>
            <Input
              id={`${uid}-min`}
              inputMode="numeric"
              value={min}
              onChange={(event) => setMin(event.target.value)}
              placeholder={t("priceMin")}
              className="h-9"
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <Label htmlFor={`${uid}-max`} className="sr-only">
              {t("priceMax")}
            </Label>
            <Input
              id={`${uid}-max`}
              inputMode="numeric"
              value={max}
              onChange={(event) => setMax(event.target.value)}
              placeholder={t("priceMax")}
              className="h-9"
            />
          </div>

          {/*
            The real bounds from the catalog, not a made-up placeholder. Absent
            when the catalog is empty, because "0 – 0" is not a hint.
          */}
          {priceRange ? (
            <p className="text-xs text-muted-foreground">
              {t("priceRange", {
                min: formatPrice(priceRange.min, locale),
                max: formatPrice(priceRange.max, locale),
              })}
            </p>
          ) : null}

          <Button type="submit" size="sm" variant="outline" className="w-full">
            {t("apply")}
          </Button>
        </fieldset>
      </form>

      <Separator />

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="mb-2 text-sm font-medium">{t("brand")}</legend>

        {brands.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("noBrands")}</p>
        ) : (
          <ul className="space-y-1">
            {brands.map((brand) => {
              const id = `${uid}-brand-${brand.slug}`;
              const checked = query.brands.includes(brand.slug);

              return (
                <li key={brand.slug} className="flex items-center gap-2.5">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => go(toggleBrand(query, brand.slug))}
                  />
                  <Label
                    htmlFor={id}
                    className="flex min-h-8 flex-1 items-center justify-between gap-2 font-normal"
                  >
                    <span className="min-w-0 truncate">{brand.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {brand.productCount}
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <Separator />

      <div className="flex items-center gap-2.5">
        <Checkbox
          id={`${uid}-sale`}
          checked={query.onSale}
          disabled={pending}
          onCheckedChange={(checked) =>
            go(withCatalogQuery(query, { onSale: checked === true }))
          }
        />
        <Label
          htmlFor={`${uid}-sale`}
          className="flex min-h-8 flex-1 items-center font-normal"
        >
          {t("onSale")}
        </Label>
      </div>

      {/* Only when there is something to clear — see `hasActiveFilters`. */}
      {showClear ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setMin("");
            setMax("");
            go(clearCatalogFilters(query));
          }}
        >
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}
