import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { toLocalizedText } from "@/lib/i18n/translations";
import { locales } from "@/lib/site-config";
import { toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Product variants — the configurations a product is actually sold as.
 *
 * Backed by the four tables added in `20260808001000_product_variants.sql`:
 *
 *     product_options → product_option_values → product_variants
 *                                             → product_variant_options
 *
 * The admin edits an **axis matrix** — "RAM: 16GB, 32GB" × "Storage: 1TB, 2TB"
 * — and this module is the fold between that and the normalized rows. Nothing
 * above it sees a join table, and nothing below it sees a matrix.
 *
 * ## Stock is not here
 *
 * `Variant.stockOnHand` is read from `inventory`, joined on `variant_id`, and it
 * is **read-only through this module**. Changing it goes through
 * `inventory.service`'s `recordMovement`, because a trigger owns
 * `quantity_on_hand` and an overwrite would destroy the ledger (ADR-24). A
 * setter here would be the obvious place to get that wrong, so there is not one.
 *
 * ## Regeneration keeps what still exists
 *
 * `syncVariants` matches incoming rows to existing ones **by their option
 * combination**, not by array position. Adding a value to an axis therefore
 * leaves the prices already entered on every combination that survives — the
 * behaviour the Phase 3A editor described and could not implement without a
 * table to persist it to.
 */

// -----------------------------------------------------------------------------
// Shapes
// -----------------------------------------------------------------------------

/** One axis: `ram` → "Memory" / "Xotira" / "Память", with its allowed values. */
export type VariantOption = {
  id: string;
  key: string;
  position: number;
  name: LocalizedText;
  values: readonly { id: string; value: string; position: number }[];
};

export type Variant = {
  id: string;
  sku: string;
  barcode: string | null;
  priceCents: number;
  salePriceCents: number | null;
  costPriceCents: number | null;
  weightGrams: number | null;
  position: number;
  isActive: boolean;
  /** Axis key → value, e.g. `{ ram: "32GB", storage: "1TB" }`. */
  options: Record<string, string>;
  /** From `inventory`, joined on `variant_id`. Read-only here (ADR-24). */
  stockOnHand: number;
  stockReserved: number;
};

const OPTION_COLUMNS = `
  id, key, position,
  translations:product_option_translations ( locale, name ),
  values:product_option_values ( id, value, position )
` as const;

const VARIANT_COLUMNS = `
  id, sku, barcode, price_cents, sale_price_cents, cost_price_cents,
  weight_grams, position, is_active,
  options:product_variant_options (
    option:product_options ( key ),
    value:product_option_values ( value )
  ),
  inventory ( quantity_on_hand, quantity_reserved )
` as const;

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export async function listOptions(
  supabase: Client,
  productId: string,
): Promise<VariantOption[]> {
  const { data, error } = await supabase
    .from("product_options")
    .select(OPTION_COLUMNS)
    .eq("product_id", productId)
    .order("position", { ascending: true });

  if (error) throw toAppError(error, "load the variant options");

  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.key,
    position: row.position,
    name: toLocalizedText(row.translations ?? [], "name"),
    values: [...(row.values ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((value) => ({
        id: value.id,
        value: value.value,
        position: value.position,
      })),
  }));
}

export async function listVariants(
  supabase: Client,
  productId: string,
): Promise<Variant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select(VARIANT_COLUMNS)
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw toAppError(error, "load the variants");

  return (data ?? []).map(fold);
}

function fold(row: Record<string, unknown>): Variant {
  const options: Record<string, string> = {};

  for (const entry of (row.options ?? []) as {
    option: { key: string } | null;
    value: { value: string } | null;
  }[]) {
    if (entry.option?.key && entry.value?.value) {
      options[entry.option.key] = entry.value.value;
    }
  }

  // PostgREST returns an embedded one-to-one as an object and a one-to-many as
  // an array depending on how it resolves the relationship, so both are handled
  // rather than assumed.
  const inventoryRow = Array.isArray(row.inventory)
    ? (row.inventory[0] as
        { quantity_on_hand: number; quantity_reserved: number } | undefined)
    : (row.inventory as {
        quantity_on_hand: number;
        quantity_reserved: number;
      } | null);

  return {
    id: row.id as string,
    sku: row.sku as string,
    barcode: (row.barcode as string | null) ?? null,
    priceCents: row.price_cents as number,
    salePriceCents: (row.sale_price_cents as number | null) ?? null,
    costPriceCents: (row.cost_price_cents as number | null) ?? null,
    weightGrams: (row.weight_grams as number | null) ?? null,
    position: row.position as number,
    isActive: row.is_active as boolean,
    options,
    stockOnHand: inventoryRow?.quantity_on_hand ?? 0,
    stockReserved: inventoryRow?.quantity_reserved ?? 0,
  };
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

export type OptionInput = {
  key: string;
  name: LocalizedText;
  values: readonly string[];
};

/**
 * Replaces a product's axes and their values.
 *
 * Values are matched by their text, so an axis edited from `["16GB", "32GB"]` to
 * `["16GB", "32GB", "64GB"]` keeps the two existing value rows and their ids —
 * which is what lets the variants referencing them survive. Deleting a value
 * cascades to every `product_variant_options` row that used it, and the
 * variants left holding no value on that axis are pruned by `syncVariants`.
 */
export async function replaceOptions(
  supabase: Client,
  productId: string,
  options: readonly OptionInput[],
): Promise<VariantOption[]> {
  const existing = await listOptions(supabase, productId);
  const keepKeys = new Set(options.map((option) => option.key));

  const removed = existing.filter((option) => !keepKeys.has(option.key));
  if (removed.length > 0) {
    const { error } = await supabase
      .from("product_options")
      .delete()
      .in(
        "id",
        removed.map((option) => option.id),
      );

    if (error) throw toAppError(error, "remove a variant option");
  }

  for (const [index, option] of options.entries()) {
    const match = existing.find((current) => current.key === option.key);

    const { data: saved, error } = await supabase
      .from("product_options")
      .upsert(
        {
          ...(match ? { id: match.id } : {}),
          product_id: productId,
          key: option.key,
          position: index,
        },
        { onConflict: "product_id,key" },
      )
      .select("id")
      .single();

    if (error) throw toAppError(error, "save a variant option");

    // Built explicitly rather than through `toTranslationRows`, which widens to
    // `Record<string, unknown>` and hides `name` from the generated insert
    // type — the one thing worth keeping checked here.
    const { error: translationError } = await supabase
      .from("product_option_translations")
      .upsert(
        locales.map((locale) => ({
          option_id: saved.id,
          locale,
          name: option.name[locale],
        })),
        { onConflict: "option_id,locale" },
      );

    if (translationError) {
      throw toAppError(translationError, "save the option name");
    }

    // Values the axis no longer offers. Removing one is a real decision — every
    // variant using it goes with it — so it is done explicitly rather than by
    // deleting and re-inserting the whole axis, which would orphan every
    // variant on every save.
    const stale = (match?.values ?? []).filter(
      (value) => !option.values.includes(value.value),
    );

    if (stale.length > 0) {
      const { error: deleteError } = await supabase
        .from("product_option_values")
        .delete()
        .in(
          "id",
          stale.map((value) => value.id),
        );

      if (deleteError) throw toAppError(deleteError, "remove an option value");
    }

    if (option.values.length > 0) {
      const { error: valueError } = await supabase
        .from("product_option_values")
        .upsert(
          option.values.map((value, valueIndex) => ({
            option_id: saved.id,
            value,
            position: valueIndex,
          })),
          { onConflict: "option_id,value" },
        );

      if (valueError) throw toAppError(valueError, "save the option values");
    }
  }

  return listOptions(supabase, productId);
}

export type VariantInput = {
  /** Present for an existing variant; absent creates one. */
  id?: string;
  sku: string;
  barcode?: string | null;
  priceCents: number;
  salePriceCents?: number | null;
  costPriceCents?: number | null;
  weightGrams?: number | null;
  isActive?: boolean;
  /** Axis key → value. Must name a value the axis actually offers. */
  options: Record<string, string>;
};

/** A stable identity for a combination, independent of array order. */
function combinationKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((key) => `${key}=${options[key]}`)
    .join("|");
}

/**
 * Reconciles a product's variants with the matrix the editor produced.
 *
 * Matched **by combination**, never by position: regenerating after adding a
 * value to an axis must not shuffle prices onto the wrong configurations. A
 * combination that disappears is soft-deleted rather than removed, because an
 * order will reference it once checkout exists.
 */
export async function syncVariants(
  supabase: Client,
  productId: string,
  variants: readonly VariantInput[],
): Promise<Variant[]> {
  const options = await listOptions(supabase, productId);
  const existing = await listVariants(supabase, productId);

  const valueId = new Map<string, string>();
  for (const option of options) {
    for (const value of option.values) {
      valueId.set(`${option.key}=${value.value}`, value.id);
    }
  }
  const optionId = new Map(options.map((option) => [option.key, option.id]));

  const byCombination = new Map(
    existing.map((variant) => [combinationKey(variant.options), variant]),
  );
  const incoming = new Set(variants.map((v) => combinationKey(v.options)));

  // Gone from the matrix — soft delete, so history keeps resolving.
  const dropped = existing.filter(
    (variant) => !incoming.has(combinationKey(variant.options)),
  );

  if (dropped.length > 0) {
    const { error } = await supabase
      .from("product_variants")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        dropped.map((variant) => variant.id),
      );

    if (error) throw toAppError(error, "remove a variant");
  }

  for (const [index, variant] of variants.entries()) {
    const match = byCombination.get(combinationKey(variant.options));

    const payload = {
      product_id: productId,
      sku: variant.sku,
      barcode: variant.barcode ?? null,
      price_cents: variant.priceCents,
      sale_price_cents: variant.salePriceCents ?? null,
      cost_price_cents: variant.costPriceCents ?? null,
      weight_grams: variant.weightGrams ?? null,
      is_active: variant.isActive ?? true,
      position: index,
    };

    const { data: saved, error } = match
      ? await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", match.id)
          .select("id")
          .single()
      : await supabase
          .from("product_variants")
          .insert(payload)
          .select("id")
          .single();

    if (error) throw toAppError(error, "save a variant");

    // The combination is rewritten from scratch for a new variant only. An
    // existing one already holds the combination it was matched on, and
    // rewriting it every save would churn rows for no change.
    if (!match) {
      const rows = Object.entries(variant.options)
        .map(([key, value]) => ({
          variant_id: saved.id,
          option_id: optionId.get(key),
          value_id: valueId.get(`${key}=${value}`),
        }))
        .filter(
          (
            row,
          ): row is {
            variant_id: string;
            option_id: string;
            value_id: string;
          } => Boolean(row.option_id && row.value_id),
        );

      if (rows.length > 0) {
        const { error: linkError } = await supabase
          .from("product_variant_options")
          .insert(rows);

        if (linkError)
          throw toAppError(linkError, "link a variant to its options");
      }
    }
  }

  return listVariants(supabase, productId);
}

/**
 * Every combination the current axes allow, as the editor's matrix.
 *
 * Pure — no database — so the editor can preview a matrix before anything is
 * saved. The cartesian product grows fast, which is why the caller is expected
 * to cap it; three axes of four values is already 64 rows to price.
 */
export function generateCombinations(
  options: readonly { key: string; values: readonly string[] }[],
): Record<string, string>[] {
  const axes = options.filter((option) => option.values.length > 0);
  if (axes.length === 0) return [];

  return axes.reduce<Record<string, string>[]>(
    (combinations, axis) =>
      combinations.flatMap((combination) =>
        axis.values.map((value) => ({ ...combination, [axis.key]: value })),
      ),
    [{}],
  );
}
