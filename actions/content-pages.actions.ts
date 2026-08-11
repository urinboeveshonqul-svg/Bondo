"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { requirePermission } from "@/lib/admin/action-guard";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as contentService from "@/services/content-pages.service";

/**
 * Business information pages — delivery, warranty, returns, about, contact.
 *
 * Gated on `banners.manage`, which is the schema's permission for storefront
 * content and is what the RLS policy on `content_pages` asks for. No permission
 * was invented for it (ADR-44): the same person writes the warranty page and the
 * homepage banner, and a second name for one job is a second thing to grant.
 */

/**
 * A page's copy in one language.
 *
 * The title is required and the rest are not, and that split is the schema's:
 * `content_page_translations.title` is `not null` while `excerpt`, `body` and
 * the SEO fields are nullable. A page with a heading and no body is a legitimate
 * work in progress; a page with no heading is a row nothing can render a link to.
 */
const translationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "adminContent.errors.titleRequired")
    .max(200, "adminContent.errors.titleTooLong"),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().trim().max(50_000).optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
});

/**
 * All three languages, required.
 *
 * A page missing its Russian renders an empty document for every Russian-reading
 * visitor — the storefront has no fallback and should not grow one, because a
 * silent fallback is how a page ships in one language and nobody notices (§ 11).
 */
const translationsSchema = z.object(
  Object.fromEntries(
    locales.map((locale) => [locale, translationSchema]),
  ) as Record<(typeof locales)[number], typeof translationSchema>,
);

/** Blank means "not written", which is `null` in the column, not `""`. */
const nullable = (value: string | undefined): string | null =>
  value && value.length > 0 ? value : null;

function revalidateContent(key: string): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}${routes.admin.content}`);
    // The storefront route is named by the key: `delivery` renders at
    // `/uz/delivery`. A page whose key is not one of the five info routes has no
    // storefront URL yet, and revalidating a path that does not exist is a
    // no-op rather than an error.
    revalidatePath(`/${locale}/${key}`);
    // The footer lists the published pages, so it is stale on any change.
    revalidatePath(`/${locale}`, "layout");
  }
}

export const saveContentPage = createAction(
  "saveContentPage",
  z.object({
    id: z.uuid().optional(),
    key: z
      .string()
      .trim()
      .min(2)
      .max(60)
      // The key becomes a storefront path segment, so it is constrained to what
      // a URL can carry without escaping.
      .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "adminContent.errors.keyFormat"),
    isPublished: z.boolean(),
    displayOrder: z.number().int().min(0).max(1000),
    translations: translationsSchema,
  }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();

    const page = await contentService.saveContentPage(supabase, {
      ...(input.id ? { id: input.id } : {}),
      key: input.key,
      isPublished: input.isPublished,
      displayOrder: input.displayOrder,
      translations: Object.fromEntries(
        locales.map((locale) => {
          const value = input.translations[locale];
          return [
            locale,
            {
              title: value.title,
              excerpt: nullable(value.excerpt),
              body: nullable(value.body),
              seoTitle: nullable(value.seoTitle),
              seoDescription: nullable(value.seoDescription),
            },
          ];
        }),
      ) as Parameters<typeof contentService.saveContentPage>[1]["translations"],
    });

    revalidateContent(input.key);

    return { id: page.id };
  },
);

export const setContentPagePublished = createAction(
  "setContentPagePublished",
  z.object({ id: z.uuid(), key: z.string().trim(), isPublished: z.boolean() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await contentService.setContentPagePublished(
      supabase,
      input.id,
      input.isPublished,
    );

    revalidateContent(input.key);

    return { isPublished: input.isPublished };
  },
);

export const deleteContentPage = createAction(
  "deleteContentPage",
  z.object({ id: z.uuid(), key: z.string().trim() }),
  async (input) => {
    await requirePermission("banners.manage");

    const supabase = await createClient();
    await contentService.deleteContentPage(supabase, input.id);

    revalidateContent(input.key);

    return { deleted: true };
  },
);
