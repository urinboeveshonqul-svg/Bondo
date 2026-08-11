"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { requirePermission } from "@/lib/admin/action-guard";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as settingsService from "@/services/settings.service";

/**
 * Store settings.
 *
 * Gated on `settings.update`, which is also what the RLS policy on both
 * `settings` and `setting_translations` asks for — the guard turns a refusal
 * into a sentence instead of a Postgres error code (ADR-4).
 *
 * ## The editable set is closed, and that is the point
 *
 * `EDITABLE_KEYS` is a whitelist rather than "whatever the form posted". The
 * settings table is a key/value store, so an unfiltered upsert would let a
 * crafted request create arbitrary rows — including a key the storefront reads
 * for something security-relevant later. Every key here has a consumer today:
 * `getStoreContact()` reads five of them for the contact page, and the catalog
 * reader takes its page size from two more.
 *
 * `store.currency` is absent deliberately. ADR-2 stores every price as an
 * integer in minor units of one store-wide currency and nothing converts, so
 * editing the code would relabel prices rather than convert them.
 */
const PLAIN_KEYS = [
  "store.name",
  "store.support_email",
  "store.phone",
  "store.telegram",
  "orders.low_stock_email",
] as const;

const NUMERIC_KEYS = [
  "catalog.products_per_page",
  "catalog.max_products_per_page",
] as const;

/** Prose a customer reads: the text lives in `setting_translations` (§ 11). */
const LOCALIZED_KEYS = ["store.address", "store.hours"] as const;

const localeSchema = z.enum(locales);

/**
 * An empty string clears a setting rather than storing `""`.
 *
 * `getStoreContact()` treats null and blank alike, but the difference matters in
 * the table: `null` is "not configured", and an empty string is a value somebody
 * chose. Normalising here keeps the row honest about which it is.
 */
const optionalText = z
  .string()
  .trim()
  .max(400)
  .transform((value) => (value.length > 0 ? value : null));

export const saveSettings = createAction(
  "saveSettings",
  z.object({
    // `partialRecord`, not `record`: a tab saves the keys it owns, and
    // `z.record` over an enum requires every member — which would make saving
    // the store tab fail for want of a catalog key it never showed.
    plain: z.partialRecord(z.enum(PLAIN_KEYS), optionalText).default({}),
    numeric: z
      .partialRecord(z.enum(NUMERIC_KEYS), z.number().int().min(1).max(200))
      .default({}),
    localized: z
      .partialRecord(
        z.enum(LOCALIZED_KEYS),
        z.partialRecord(localeSchema, z.string().trim().max(400)),
      )
      .default({}),
  }),
  async (input) => {
    await requirePermission("settings.update");

    const supabase = await createClient();

    // `value` is jsonb, so a string setting is a JSON string and a cleared one
    // is JSON null — not the SQL NULL the column forbids.
    const values: Record<string, ReturnType<typeof JSON.parse>> = {};
    for (const [key, value] of Object.entries(input.plain)) {
      values[key] = value;
    }
    for (const [key, value] of Object.entries(input.numeric)) {
      values[key] = value;
    }

    const translations = Object.entries(input.localized).flatMap(
      ([key, byLocale]) =>
        Object.entries(byLocale ?? {}).map(([locale, value]) => ({
          key,
          locale: locale as (typeof locales)[number],
          value,
        })),
    );

    await settingsService.updateSettings(supabase, values);
    await settingsService.updateSettingTranslations(supabase, translations);

    // The contact page renders these, and the admin screen re-reads them.
    for (const locale of locales) {
      revalidatePath(`/${locale}${routes.info.contact}`);
      revalidatePath(`/${locale}${routes.admin.settings}`);
    }

    return {
      settings: Object.keys(values).length,
      translations: translations.length,
    };
  },
);
