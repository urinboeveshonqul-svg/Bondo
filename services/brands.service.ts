import type { SupabaseClient } from "@supabase/supabase-js";

import { toLocalizedText, toTranslationRows } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/site-config";
import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { LocalizedText } from "@/types/catalog";
import type { Database, TablesInsert } from "@/types/database";

type Client = SupabaseClient<Database>;

const COLUMNS = `
  id, slug, name, logo_path, website_url, is_featured, is_visible, updated_at,
  translations:brand_translations ( locale, description, seo_title, seo_description )
` as const;

/**
 * A brand.
 *
 * `name` and `slug` are **not** localized and stay on the parent: a brand name
 * is a trademark that reads identically in every language, and transliterating
 * "NVIDIA" into Cyrillic makes it unsearchable. Only the prose Bondo writes
 * about a brand is translated.
 */
export type Brand = {
  id: string;
  slug: string;
  name: string;
  logoPath: string | null;
  websiteUrl: string | null;
  isFeatured: boolean;
  isVisible: boolean;
  updatedAt: string;
  description: LocalizedText;
  seoTitle: LocalizedText;
  seoDescription: LocalizedText;
};

type RawTranslation = { locale: Locale } & Record<string, unknown>;

function fold(row: Record<string, unknown>): Brand {
  const translations = (row.translations ?? []) as RawTranslation[];

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    logoPath: (row.logo_path ?? null) as string | null,
    websiteUrl: (row.website_url ?? null) as string | null,
    isFeatured: row.is_featured as boolean,
    isVisible: row.is_visible as boolean,
    updatedAt: row.updated_at as string,
    description: toLocalizedText(translations, "description"),
    seoTitle: toLocalizedText(translations, "seo_title"),
    seoDescription: toLocalizedText(translations, "seo_description"),
  };
}

export async function listBrands(
  supabase: Client,
  options: { visibleOnly?: boolean; featuredOnly?: boolean } = {},
): Promise<Brand[]> {
  let query = supabase
    .from("brands")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (options.visibleOnly) query = query.eq("is_visible", true);
  if (options.featuredOnly) query = query.eq("is_featured", true);

  const { data, error } = await query;
  if (error) throw toAppError(error, "list brands");

  return (data ?? []).map((row) => fold(row as Record<string, unknown>));
}

export async function getBrandBySlug(
  supabase: Client,
  slug: string,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands")
    .select(COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw toAppError(error, "load the brand");
  if (!data) throw notFoundOrForbidden("Brand");

  return fold(data as unknown as Record<string, unknown>);
}

export async function getBrandById(
  supabase: Client,
  id: string,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw toAppError(error, "load the brand");
  if (!data) throw notFoundOrForbidden("Brand");

  return fold(data as unknown as Record<string, unknown>);
}

export type BrandInput = {
  slug: string;
  name: string;
  logoPath?: string | null;
  websiteUrl?: string | null;
  isFeatured?: boolean;
  isVisible?: boolean;
  description?: LocalizedText;
  seoTitle?: LocalizedText;
  seoDescription?: LocalizedText;
};

async function saveTranslations(
  supabase: Client,
  brandId: string,
  input: BrandInput,
): Promise<void> {
  const rows = toTranslationRows(
    { brand_id: brandId },
    {
      description: input.description,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
    },
  );

  // A brand with no prose is legitimate — the name carries it — so an empty
  // set is not an error here, unlike a product with no name.
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("brand_translations")
    .upsert(rows as TablesInsert<"brand_translations">[], {
      onConflict: "brand_id,locale",
    });

  if (error) throw toAppError(error, "save the brand translations");
}

export async function createBrand(
  supabase: Client,
  input: BrandInput,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug: input.slug,
      name: input.name,
      logo_path: input.logoPath ?? null,
      website_url: input.websiteUrl ?? null,
      is_featured: input.isFeatured ?? false,
      is_visible: input.isVisible ?? true,
    })
    .select("id")
    .single();

  if (error) throw toAppError(error, "create the brand");

  try {
    await saveTranslations(supabase, data.id, input);
  } catch (cause) {
    await supabase.from("brands").delete().eq("id", data.id);
    throw cause;
  }

  return getBrandById(supabase, data.id);
}

export async function updateBrand(
  supabase: Client,
  id: string,
  input: BrandInput,
): Promise<Brand> {
  const { data, error } = await supabase
    .from("brands")
    .update({
      slug: input.slug,
      name: input.name,
      logo_path: input.logoPath ?? null,
      website_url: input.websiteUrl ?? null,
      is_featured: input.isFeatured ?? false,
      is_visible: input.isVisible ?? true,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw toAppError(error, "update the brand");
  if (!data) throw notFoundOrForbidden("Brand");

  await saveTranslations(supabase, id, input);

  return getBrandById(supabase, id);
}

/**
 * Soft delete.
 *
 * `products.brand_id` is `on delete restrict`, so a hard delete fails while any
 * product carries the brand. Soft deleting retires it without touching them.
 */
export async function softDeleteBrand(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error, count } = await supabase
    .from("brands")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw toAppError(error, "delete the brand");
  if (count === 0) throw notFoundOrForbidden("Brand");
}

/** Product counts per brand — see the note in `countProductsByCategory`. */
export async function countProductsByBrand(
  supabase: Client,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("brand_id")
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null);

  if (error) throw toAppError(error, "count products by brand");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.brand_id) continue;
    counts.set(row.brand_id, (counts.get(row.brand_id) ?? 0) + 1);
  }

  return counts;
}
