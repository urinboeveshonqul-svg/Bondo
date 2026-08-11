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
 * Homepage banners.
 *
 * Gated on `banners.manage`, which is what the RLS policy on `site_banners` and
 * `banner_translations` asks for.
 *
 * ## Every field here has a column
 *
 * The screen this replaces also offered a homepage *section* editor — reorderable
 * bands with a type and a target. There is no table behind any of it, and the
 * home page does not compose itself that way: it derives its rails from the
 * category tree (ADR-75). Those controls are gone rather than persisted into an
 * invented schema, because a table nothing reads is the same lie as a fixture,
 * only harder to notice later.
 */

const placementSchema = z.enum([
  "home_hero",
  "home_secondary",
  "category_top",
  "site_wide_notice",
]);

const translationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "adminContent.errors.titleRequired")
    .max(200, "adminContent.errors.titleTooLong"),
  subtitle: z.string().trim().max(400).optional(),
  ctaLabel: z.string().trim().max(80).optional(),
});

/**
 * All three languages, required.
 *
 * `listActiveBannersForLocale` drops a banner that has no row for the visitor's
 * language rather than rendering an empty heading, so a banner saved in one
 * language would simply not appear for two thirds of the audience — visibly
 * fine to the operator who checked their own (§ 11).
 */
const translationsSchema = z.object(
  Object.fromEntries(
    locales.map((locale) => [locale, translationSchema]),
  ) as Record<(typeof locales)[number], typeof translationSchema>,
);

const nullable = (value: string | undefined): string | null =>
  value && value.length > 0 ? value : null;

function revalidateBanners(): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}${routes.admin.homepage}`);
  }
}

export const saveBanner = createAction(
  "saveBanner",
  z.object({
    id: z.uuid().optional(),
    placement: placementSchema,
    /** Relative or absolute; empty means the banner is not a link. */
    linkUrl: z.string().trim().max(500).optional(),
    displayOrder: z.number().int().min(0).max(1000),
    isActive: z.boolean(),
    // A window, not a schedule: both ends optional, which is what the columns
    // allow and what "runs until we turn it off" means.
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    translations: translationsSchema,
  }),
  async (input) => {
    await requirePermission("banners.manage");

    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      // Caught here rather than by a check constraint because the message is
      // for the operator, and a 23514 is not.
      throw new Error("adminContent.errors.endBeforeStart");
    }

    const supabase = await createClient();

    const banner = await settingsService.saveBanner(supabase, {
      ...(input.id ? { id: input.id } : {}),
      placement: input.placement,
      linkUrl: nullable(input.linkUrl),
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      translations: Object.fromEntries(
        locales.map((locale) => {
          const value = input.translations[locale];
          return [
            locale,
            {
              title: value.title,
              subtitle: nullable(value.subtitle),
              ctaLabel: nullable(value.ctaLabel),
            },
          ];
        }),
      ) as Parameters<typeof settingsService.saveBanner>[1]["translations"],
    });

    revalidateBanners();

    return { id: banner.id };
  },
);

export const setBannerActive = createAction(
  "setBannerActive",
  z.object({ id: z.uuid(), isActive: z.boolean() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await settingsService.setBannerActive(supabase, input.id, input.isActive);

    revalidateBanners();

    return { isActive: input.isActive };
  },
);

export const deleteBanner = createAction(
  "deleteBanner",
  z.object({ id: z.uuid() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await settingsService.deleteBanner(supabase, input.id);

    revalidateBanners();

    return { deleted: true };
  },
);
