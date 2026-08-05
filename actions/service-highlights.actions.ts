"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { HIGHLIGHT_ICON_NAMES } from "@/components/home/highlight-icon";
import { requirePermission } from "@/lib/admin/action-guard";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as highlightsService from "@/services/service-highlights.service";

/**
 * Service highlight management.
 *
 * Every action is gated on `banners.manage` — a highlight is storefront content
 * managed by whoever manages banners, and no permission was invented for it
 * (ADR-44). The gate is defence in depth; RLS refuses the write regardless.
 */

/**
 * The icon must be one the storefront can actually draw.
 *
 * Validated against the component's own map rather than a copy of it, so the
 * set cannot drift: adding a glyph to `HIGHLIGHT_ICONS` is what makes it
 * selectable, and nothing else needs editing. The database check constraint is
 * the second gate — it enforces the *shape* of an identifier, this enforces
 * membership.
 */
const iconSchema = z
  .string()
  .refine(
    (value) => HIGHLIGHT_ICON_NAMES.includes(value),
    "adminHighlights.errors.unknownIcon",
  );

const translationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "adminHighlights.errors.titleRequired")
    .max(120, "adminHighlights.errors.titleTooLong"),
  description: z
    .string()
    .trim()
    .min(1, "adminHighlights.errors.descriptionRequired")
    .max(400, "adminHighlights.errors.descriptionTooLong"),
});

/**
 * All three languages, required.
 *
 * Not optional and not partial: a highlight missing its Russian renders a gap in
 * the trust row for every Russian-reading visitor, and the storefront has no
 * sensible fallback to show instead. Refusing the save is how that stays
 * impossible rather than merely discouraged (§ 11).
 */
const translationsSchema = z.object(
  Object.fromEntries(
    locales.map((locale) => [locale, translationSchema]),
  ) as Record<(typeof locales)[number], typeof translationSchema>,
);

/** Both the storefront home page and the admin list render this data. */
function revalidateHighlights(): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}${routes.admin.highlights}`);
  }
}

export const saveHighlight = createAction(
  "saveHighlight",
  z.object({
    id: z.uuid().optional(),
    icon: iconSchema,
    displayOrder: z.number().int().min(0).max(1000),
    isVisible: z.boolean(),
    translations: translationsSchema,
  }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    const highlight = await highlightsService.saveHighlight(supabase, input);

    revalidateHighlights();

    return { id: highlight.id };
  },
);

export const deleteHighlight = createAction(
  "deleteHighlight",
  z.object({ id: z.uuid() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await highlightsService.deleteHighlight(supabase, input.id);

    revalidateHighlights();

    return { deleted: true };
  },
);

export const reorderHighlights = createAction(
  "reorderHighlights",
  // The whole sequence, not a single move: the write is then idempotent and
  // cannot interleave badly with somebody else reordering at the same time.
  z.object({ orderedIds: z.array(z.uuid()).min(1).max(100) }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await highlightsService.reorderHighlights(supabase, input.orderedIds);

    revalidateHighlights();

    return { ordered: input.orderedIds.length };
  },
);

export const setHighlightVisibility = createAction(
  "setHighlightVisibility",
  z.object({ id: z.uuid(), isVisible: z.boolean() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await highlightsService.setHighlightVisibility(
      supabase,
      input.id,
      input.isVisible,
    );

    revalidateHighlights();

    return { isVisible: input.isVisible };
  },
);
