import type { SupabaseClient } from "@supabase/supabase-js";

import { toAppError } from "@/lib/supabase-error";
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
    .order("display_order", { ascending: true });

  if (error) throw toAppError(error, "load the banners");

  return data ?? [];
}
