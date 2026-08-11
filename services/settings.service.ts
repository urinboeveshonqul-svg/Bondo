import type { SupabaseClient } from "@supabase/supabase-js";

import { notFoundOrForbidden, toAppError } from "@/lib/supabase-error";
import type { Database, Json, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * Store settings and homepage banners.
 *
 * `public.settings` is a key/value table with an `is_public` flag: anonymous
 * visitors may read the public subset (store name, currency) and nothing else.
 * The flag is enforced by RLS, so the storefront reading with the anon key gets
 * the safe rows whether or not this service filters — the filter here is so the
 * intent is legible, not because it is the control.
 */

export async function getPublicSettings(
  supabase: Client,
): Promise<Record<string, Json>> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .eq("is_public", true);

  if (error) throw toAppError(error, "load the store settings");

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

/**
 * The public settings, with localized keys resolved to one language.
 *
 * A key flagged `is_localized` holds JSON `null` in `value` and its text in
 * `setting_translations`, so `getPublicSettings` alone reports it as unset —
 * which is how the contact page's address and opening hours would render blank
 * however carefully an operator filled them in.
 *
 * Both queries run under the anon key on the storefront, so RLS decides what
 * comes back: the `is_public` filter here is legibility, not the control.
 */
export async function getPublicSettingsForLocale(
  supabase: Client,
  locale: Database["public"]["Enums"]["locale"],
): Promise<Record<string, string | null>> {
  const [settings, translations] = await Promise.all([
    supabase
      .from("settings")
      .select("key, value, is_localized")
      .eq("is_public", true),
    supabase
      .from("setting_translations")
      .select("setting_key, value")
      .eq("locale", locale),
  ]);

  if (settings.error) throw toAppError(settings.error, "load the settings");
  if (translations.error) {
    throw toAppError(translations.error, "load the settings");
  }

  const localized = new Map(
    (translations.data ?? []).map((row) => [row.setting_key, row.value]),
  );

  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  return Object.fromEntries(
    (settings.data ?? []).map((row) => [
      row.key,
      row.is_localized ? text(localized.get(row.key)) : text(row.value),
    ]),
  );
}

/** Every setting, public and private. Requires `settings.read`. */
export async function getAllSettings(
  supabase: Client,
): Promise<Record<string, Json>> {
  const { data, error } = await supabase.from("settings").select("key, value");

  if (error) throw toAppError(error, "load the settings");

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

/**
 * Writes several settings at once.
 *
 * One `upsert` rather than a loop: the settings form saves a whole tab, and
 * eleven sequential round trips would be both slow and non-atomic in a way the
 * operator can see (half a tab saved).
 */
export async function updateSettings(
  supabase: Client,
  values: Record<string, Json>,
): Promise<void> {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "key" });

  if (error) throw toAppError(error, "save the settings");
}

/**
 * A setting as the admin panel edits it: the row, plus its per-locale text when
 * the key is flagged `is_localized`.
 *
 * Two shapes rather than one because the schema has two: a currency code is a
 * jsonb scalar on `settings`, and an address is prose with one row per language
 * in `setting_translations`. Flattening them into a single "value" would mean
 * the form could not tell which it was editing, and would write the wrong table.
 */
export type ManagedSetting = {
  key: string;
  value: Json;
  description: string | null;
  isPublic: boolean;
  isLocalized: boolean;
  /** Empty for a key that is not localized. */
  translations: Partial<Record<Database["public"]["Enums"]["locale"], string>>;
};

/** Every setting with its translations. Requires `settings.read`. */
export async function listManagedSettings(
  supabase: Client,
): Promise<ManagedSetting[]> {
  const [settings, translations] = await Promise.all([
    supabase
      .from("settings")
      .select("key, value, description, is_public, is_localized")
      .order("key"),
    supabase.from("setting_translations").select("setting_key, locale, value"),
  ]);

  if (settings.error) throw toAppError(settings.error, "load the settings");
  if (translations.error) {
    throw toAppError(translations.error, "load the settings");
  }

  const byKey = new Map<string, ManagedSetting["translations"]>();
  for (const row of translations.data ?? []) {
    const bucket = byKey.get(row.setting_key) ?? {};
    bucket[row.locale] = row.value;
    byKey.set(row.setting_key, bucket);
  }

  return (settings.data ?? []).map((row) => ({
    key: row.key,
    value: row.value,
    description: row.description,
    isPublic: row.is_public,
    isLocalized: row.is_localized,
    translations: byKey.get(row.key) ?? {},
  }));
}

/**
 * Writes the localized text of a setting, one row per language.
 *
 * Upsert on the composite key rather than delete-then-insert: the pair is the
 * primary key, so a replace would briefly leave the storefront with no text for
 * a language it was already showing.
 */
export async function updateSettingTranslations(
  supabase: Client,
  values: {
    key: string;
    locale: Database["public"]["Enums"]["locale"];
    value: string;
  }[],
): Promise<void> {
  if (values.length === 0) return;

  const { error } = await supabase.from("setting_translations").upsert(
    values.map((row) => ({
      setting_key: row.key,
      locale: row.locale,
      value: row.value,
    })),
    { onConflict: "setting_key,locale" },
  );

  if (error) throw toAppError(error, "save the settings");
}

export type BannerRow = Tables<"site_banners">;

/**
 * Banners that should be on screen right now.
 *
 * The date window is applied in the query, not in the caller: a banner whose
 * `starts_at` has not arrived must not reach the client at all, and filtering
 * after fetching would ship unpublished marketing copy to anyone reading the
 * network tab.
 */
export async function listActiveBanners(
  supabase: Client,
  placement?: Database["public"]["Enums"]["banner_placement"],
): Promise<BannerRow[]> {
  const now = new Date().toISOString();

  let query = supabase
    .from("site_banners")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("display_order", { ascending: true });

  if (placement) query = query.eq("placement", placement);

  const { data, error } = await query;
  if (error) throw toAppError(error, "load the banners");

  return data ?? [];
}

/** Every banner, including scheduled and expired. Requires `banners.read`. */
export async function listAllBanners(supabase: Client): Promise<BannerRow[]> {
  const { data, error } = await supabase
    .from("site_banners")
    .select("*")
    .is("deleted_at", null)
    .order("display_order", { ascending: true });

  if (error) throw toAppError(error, "load the banners");

  return data ?? [];
}

export type BannerWithTranslations = BannerRow & {
  translations: Partial<
    Record<
      Database["public"]["Enums"]["locale"],
      { title: string; subtitle: string | null; ctaLabel: string | null }
    >
  >;
};

/** Banners with their per-language copy, for the admin editor. */
export async function listBannersForAdmin(
  supabase: Client,
): Promise<BannerWithTranslations[]> {
  const [banners, translations] = await Promise.all([
    supabase
      .from("site_banners")
      .select("*")
      .is("deleted_at", null)
      .order("display_order", { ascending: true }),
    supabase
      .from("banner_translations")
      .select("banner_id, locale, title, subtitle, cta_label"),
  ]);

  if (banners.error) throw toAppError(banners.error, "load the banners");
  if (translations.error) {
    throw toAppError(translations.error, "load the banners");
  }

  const byBanner = new Map<string, BannerWithTranslations["translations"]>();
  for (const row of translations.data ?? []) {
    const bucket = byBanner.get(row.banner_id) ?? {};
    bucket[row.locale] = {
      title: row.title,
      subtitle: row.subtitle,
      ctaLabel: row.cta_label,
    };
    byBanner.set(row.banner_id, bucket);
  }

  return (banners.data ?? []).map((banner) => ({
    ...banner,
    translations: byBanner.get(banner.id) ?? {},
  }));
}

/**
 * The banners to show right now, with copy in one language.
 *
 * All the copy is in `banner_translations`: the localization migration moved
 * `title` and `subtitle` off the parent, so a banner with no row for this
 * language has nothing to render and is dropped rather than shown blank. That
 * is the right failure — a hero with an empty heading looks broken to the
 * visitor and fine to the operator who only checked their own language.
 */
export async function listActiveBannersForLocale(
  supabase: Client,
  locale: Database["public"]["Enums"]["locale"],
  placement: Database["public"]["Enums"]["banner_placement"],
): Promise<
  {
    id: string;
    title: string;
    subtitle: string | null;
    ctaLabel: string | null;
    linkUrl: string | null;
  }[]
> {
  const banners = await listActiveBanners(supabase, placement);
  if (banners.length === 0) return [];

  const { data, error } = await supabase
    .from("banner_translations")
    .select("banner_id, title, subtitle, cta_label")
    .eq("locale", locale)
    .in(
      "banner_id",
      banners.map((banner) => banner.id),
    );

  if (error) throw toAppError(error, "load the banners");

  const byId = new Map((data ?? []).map((row) => [row.banner_id, row]));

  return banners.flatMap((banner) => {
    const translation = byId.get(banner.id);
    if (!translation) return [];

    return [
      {
        id: banner.id,
        title: translation.title,
        subtitle: translation.subtitle,
        ctaLabel: translation.cta_label,
        linkUrl: banner.link_url,
      },
    ];
  });
}

/**
 * Creates or updates a banner and its three translations.
 *
 * Same two-statement shape as `saveContentPage`, and for the same reason: the
 * translations carry a foreign key, so the parent has to exist first, and
 * PostgREST offers no interactive transaction to wrap the pair in.
 */
export async function saveBanner(
  supabase: Client,
  input: {
    id?: string;
    placement: Database["public"]["Enums"]["banner_placement"];
    linkUrl: string | null;
    displayOrder: number;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
    translations: Record<
      Database["public"]["Enums"]["locale"],
      { title: string; subtitle: string | null; ctaLabel: string | null }
    >;
  },
): Promise<BannerRow> {
  const parent = {
    placement: input.placement,
    link_url: input.linkUrl,
    display_order: input.displayOrder,
    is_active: input.isActive,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
  };

  const { data: banner, error } = input.id
    ? await supabase
        .from("site_banners")
        .update(parent)
        .eq("id", input.id)
        .select("*")
        .maybeSingle()
    : await supabase
        .from("site_banners")
        .insert(parent)
        .select("*")
        .maybeSingle();

  if (error) throw toAppError(error, "save the banner");
  if (!banner) throw notFoundOrForbidden("Banner");

  const rows = Object.entries(input.translations).map(([locale, value]) => ({
    banner_id: banner.id,
    locale: locale as Database["public"]["Enums"]["locale"],
    title: value.title,
    subtitle: value.subtitle,
    cta_label: value.ctaLabel,
  }));

  const { error: translationError } = await supabase
    .from("banner_translations")
    .upsert(rows, { onConflict: "banner_id,locale" });

  if (translationError) throw toAppError(translationError, "save the banner");

  return banner;
}

export async function setBannerActive(
  supabase: Client,
  id: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("site_banners")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw toAppError(error, "update the banner");
}

/**
 * Soft-deletes a banner.
 *
 * `deleted_at`, matching every other content table: a seasonal banner is
 * usually taken down rather than destroyed, and a hard delete would take its
 * three translations with it through `on delete cascade` — retyping a campaign
 * in three languages is a poor answer to a mis-click.
 */
export async function deleteBanner(
  supabase: Client,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("site_banners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw toAppError(error, "delete the banner");
}
