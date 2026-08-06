"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAction } from "@/actions/safe-action";
import { CATEGORY_ICON_NAMES } from "@/components/layout/category-icon";
import { requirePermission } from "@/lib/admin/action-guard";
import { routes } from "@/lib/routes";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import { Constants } from "@/types/database";
import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as productsService from "@/services/products.service";
import * as storageService from "@/services/storage.service";

/**
 * Catalog mutations — the write half of the admin panel.
 *
 * Every one goes through `createAction()` and calls the real service, which is
 * the only thing that touches Supabase (ADR-1). There is no fixture path and no
 * "changes will not be saved" branch: a save either reaches the database or
 * returns an error saying why.
 *
 * **Permissions are the database's, not invented ones** (ADR-44).
 * `requirePermission` is defence in depth — RLS refuses the write regardless
 * through `has_permission()`, so an action that forgot its guard would still be
 * refused, just with a worse message.
 *
 * ## Why the localized fields are required in all three languages
 *
 * `npm run check` already fails on a missing UI translation; the same standard
 * applies to catalog copy an operator authors. A product saved with only Uzbek
 * renders a gap for every Russian-reading shopper and there is no sensible
 * fallback — so the schema refuses it here rather than the storefront papering
 * over it later (§ 11).
 */

/** Every locale, each a non-empty trimmed string. */
const localizedText = (max: number, message: string) =>
  z.object(
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        z.string().trim().min(1, message).max(max),
      ]),
    ) as Record<(typeof locales)[number], z.ZodString>,
  );

/** Optional per locale — an empty string is stored as absent, not as "". */
const optionalLocalizedText = (max: number) =>
  z.object(
    Object.fromEntries(
      locales.map((locale) => [locale, z.string().trim().max(max).default("")]),
    ) as Record<(typeof locales)[number], z.ZodDefault<z.ZodString>>,
  );

const slugText = z.object(
  Object.fromEntries(
    locales.map((locale) => [
      locale,
      z
        .string()
        .trim()
        .min(1, "adminCatalog.errors.slugRequired")
        .max(200)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "adminCatalog.errors.slugInvalid"),
    ]),
  ) as Record<(typeof locales)[number], z.ZodString>,
);

/**
 * Invalidates every surface a catalog change is visible on.
 *
 * The storefront as well as the admin, in all three locales: a product
 * published in the panel that does not appear in the shop until the next deploy
 * is the failure this whole exercise exists to remove.
 */
function revalidateCatalog(): void {
  for (const locale of locales) {
    revalidatePath(`/${locale}`, "layout");
  }
}

// -----------------------------------------------------------------------------
// Brands
// -----------------------------------------------------------------------------

const brandSchema = z.object({
  id: z.uuid().optional(),
  // A trademark, spelled the same in every language — which is why `brands.name`
  // and `brands.slug` stayed on the parent row through the localization
  // migration rather than moving to translations.
  name: z.string().trim().min(1, "adminCatalog.errors.nameRequired").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "adminCatalog.errors.slugRequired")
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "adminCatalog.errors.slugInvalid"),
  websiteUrl: z.union([z.url(), z.literal("")]).nullish(),
  isFeatured: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  description: optionalLocalizedText(2000).optional(),
});

export const saveBrand = createAction(
  "saveBrand",
  brandSchema,
  async (input) => {
    await requirePermission("brands.manage");

    const supabase = await createClient();
    const payload = {
      name: input.name,
      slug: input.slug,
      websiteUrl: input.websiteUrl || null,
      isFeatured: input.isFeatured,
      isVisible: input.isVisible,
      ...(input.description ? { description: input.description } : {}),
    };

    const brand = input.id
      ? await brandsService.updateBrand(supabase, input.id, payload)
      : await brandsService.createBrand(supabase, payload);

    revalidateCatalog();

    return { id: brand.id, name: brand.name };
  },
);

export const deleteBrand = createAction(
  "deleteBrand",
  z.object({ id: z.uuid() }),
  async (input) => {
    await requirePermission("brands.manage");

    const supabase = await createClient();
    // **Soft delete**, because products reference brands and history should
    // survive a brand being retired (§ 12 / the Phase 2 convention).
    await brandsService.softDeleteBrand(supabase, input.id);

    revalidateCatalog();

    return { deleted: true };
  },
);

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

/**
 * The icon must be one the storefront can actually draw.
 *
 * Validated against the component's own map rather than a copy of it, so the
 * two cannot drift: adding a glyph to `CATEGORY_ICONS` is what makes it
 * selectable, and nothing else needs editing. The database check constraint is
 * the second gate — it enforces the *shape* of an identifier, this enforces
 * membership (ADR-69, extended to categories by ADR-72).
 *
 * Nullable, because most categories have no icon and should not be forced one.
 */
const categoryIconSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || CATEGORY_ICON_NAMES.includes(value),
    "adminCatalog.errors.unknownIcon",
  )
  .nullish();

const categorySchema = z.object({
  id: z.uuid().optional(),
  parentId: z.uuid().nullish(),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  isVisible: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  icon: categoryIconSchema,
  imagePath: z.string().trim().max(1024).nullish(),
  name: localizedText(200, "adminCatalog.errors.nameRequired"),
  slug: slugText,
  description: optionalLocalizedText(2000).optional(),
  // The SEO panel's fields. Length caps match the column constraints, so a
  // value this accepts is a value the insert accepts.
  seoTitle: optionalLocalizedText(120).optional(),
  seoDescription: optionalLocalizedText(320).optional(),
  // Not localized: a shopper types "rtx 4090" whatever language the page is in.
  seoKeywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  canonicalUrl: optionalLocalizedText(2048).optional(),
  ogTitle: optionalLocalizedText(120).optional(),
  ogDescription: optionalLocalizedText(320).optional(),
  ogImagePath: z.string().trim().max(1024).nullish(),
  // The generated enum, never a hand-written union (§ 12), so the select cannot
  // offer a value the insert rejects.
  twitterCard: z.enum(Constants.public.Enums.twitter_card).nullish(),
});

export const saveCategory = createAction(
  "saveCategory",
  categorySchema,
  async (input) => {
    await requirePermission("categories.manage");

    const supabase = await createClient();
    const payload = {
      parentId: input.parentId ?? null,
      displayOrder: input.displayOrder,
      isVisible: input.isVisible,
      isFeatured: input.isFeatured,
      // An empty picker means "no icon", which is `null` in the column — not
      // `""`, which the check constraint would reject.
      icon: input.icon || null,
      imagePath: input.imagePath || null,
      name: input.name,
      slug: input.slug,
      ...(input.description ? { description: input.description } : {}),
      ...(input.seoTitle ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription ? { seoDescription: input.seoDescription } : {}),
      ...(input.seoKeywords ? { seoKeywords: input.seoKeywords } : {}),
      ...(input.canonicalUrl ? { canonicalUrl: input.canonicalUrl } : {}),
      ...(input.ogTitle ? { ogTitle: input.ogTitle } : {}),
      ...(input.ogDescription ? { ogDescription: input.ogDescription } : {}),
      ogImagePath: input.ogImagePath || null,
      twitterCard: input.twitterCard ?? null,
    };

    const category = input.id
      ? await categoriesService.updateCategory(supabase, input.id, payload)
      : await categoriesService.createCategory(supabase, payload);

    revalidateCatalog();

    return { id: category.id };
  },
);

export const deleteCategory = createAction(
  "deleteCategory",
  z.object({ id: z.uuid() }),
  async (input) => {
    await requirePermission("categories.manage");

    const supabase = await createClient();
    await categoriesService.softDeleteCategory(supabase, input.id);

    revalidateCatalog();

    return { deleted: true };
  },
);

/**
 * Persists a drag-and-drop arrangement.
 *
 * Takes the **whole sibling group** — a parent and the ordered ids beneath it —
 * rather than a single moved row, because a drop changes every position after
 * the insertion point and sending one row would leave the rest stale. `parentId`
 * is part of the payload so a drag between departments is one call: dropping
 * "Videokartalar" under "Geymerlar uchun" moves it and renumbers its new
 * siblings together, or fails together.
 *
 * A cycle — dropping a department onto its own subcategory — is refused by the
 * database trigger, not here. It is the only place that sees the whole tree
 * atomically (ADR-26), and the client's copy can be one drag out of date.
 */
export const reorderCategories = createAction(
  "reorderCategories",
  z.object({
    parentId: z.uuid().nullish(),
    orderedIds: z.array(z.uuid()).min(1).max(500),
  }),
  async (input) => {
    await requirePermission("categories.manage");

    const supabase = await createClient();
    // The service takes explicit positions rather than inferring them from the
    // array index, so a caller cannot accidentally send a sparse order.
    await categoriesService.reorderCategories(
      supabase,
      input.orderedIds.map((id, index) => ({
        id,
        displayOrder: index + 1,
        parentId: input.parentId ?? null,
      })),
    );

    revalidateCatalog();

    return { ordered: input.orderedIds.length };
  },
);

/**
 * Uploads a category image and returns the storage path the form should save.
 *
 * The `File` crosses the Server Action boundary directly — Next.js serialises it
 * over the same multipart channel a form submission uses — so this stays the
 * plain-object call every other action here makes, and `z.instanceof(File)` is
 * what proves the caller actually sent one.
 *
 * It does **not** write `image_path`. The upload returns a path, the form holds
 * it, and the operator's Save is what commits it — so uploading and then
 * abandoning the form leaves the category exactly as it was. The cost is a few
 * kilobytes of orphaned object, which is the right way round: the alternative
 * writes to a live category before the operator has agreed to it.
 */
export const uploadCategoryImage = createAction(
  "uploadCategoryImage",
  z.object({
    categoryId: z.uuid(),
    file: z.instanceof(File, { message: "adminCatalog.errors.imageRequired" }),
  }),
  async (input) => {
    await requirePermission("categories.manage");

    const supabase = await createClient();
    const path = await storageService.uploadCategoryImage(
      supabase,
      input.categoryId,
      input.file,
    );

    return {
      path,
      url: storageService.publicUrl(supabase, "site-assets", path),
    };
  },
);

/**
 * Shows or hides a category from the list, without a round trip through the
 * editor.
 *
 * Its own action rather than a `saveCategory` call, because the list does not
 * hold the translated copy and sending a save from there would blank every
 * field the row was not carrying.
 */
export const setCategoryVisibility = createAction(
  "setCategoryVisibility",
  z.object({ id: z.uuid(), isVisible: z.boolean() }),
  async (input) => {
    await requirePermission("categories.manage");

    const supabase = await createClient();
    await categoriesService.setCategoryVisibility(
      supabase,
      input.id,
      input.isVisible,
    );

    revalidateCatalog();

    return { isVisible: input.isVisible };
  },
);

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

const productSchema = z.object({
  id: z.uuid().optional(),
  sku: z
    .string()
    .trim()
    .min(1, "adminCatalog.errors.skuRequired")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "adminCatalog.errors.skuInvalid"),
  name: localizedText(300, "adminCatalog.errors.nameRequired"),
  slug: slugText,
  shortDescription: optionalLocalizedText(500),
  description: optionalLocalizedText(20_000),
  brandId: z.uuid().nullish(),
  categoryId: z.uuid().nullish(),
  // Minor units (ADR-2). The form converts; accepting a float here would land a
  // rounding error in a price.
  priceCents: z.number().int().min(0).max(1_000_000_000),
  salePriceCents: z.number().int().min(0).max(1_000_000_000).nullish(),
  status: z.enum(["draft", "active", "archived"]),
  visibility: z.enum(["public", "hidden"]),
  isFeatured: z.boolean().default(false),
  warrantyMonths: z.number().int().min(0).max(240).nullish(),
});

export const saveProduct = createAction(
  "saveProduct",
  productSchema,
  async (input) => {
    // Create and update are different permissions in the schema, so the guard
    // asks the right one rather than the broader one.
    await requirePermission(input.id ? "products.update" : "products.create");

    const supabase = await createClient();
    const payload = {
      sku: input.sku,
      name: input.name,
      slug: input.slug,
      shortDescription: input.shortDescription,
      description: input.description,
      brandId: input.brandId ?? null,
      categoryId: input.categoryId ?? null,
      priceCents: input.priceCents,
      salePriceCents: input.salePriceCents ?? null,
      status: input.status,
      visibility: input.visibility,
      isFeatured: input.isFeatured,
      warrantyMonths: input.warrantyMonths ?? null,
    };

    const product = input.id
      ? await productsService.updateProduct(supabase, input.id, payload)
      : await productsService.createProduct(supabase, payload);

    revalidateCatalog();

    return { id: product.id, sku: product.sku };
  },
);

export const deleteProduct = createAction(
  "deleteProduct",
  z.object({ id: z.uuid() }),
  async (input) => {
    await requirePermission("products.delete");

    const supabase = await createClient();
    // Soft, deliberately: an order line references a product, and a hard delete
    // would break the record of having sold it (ADR-2's sibling reasoning about
    // history). `restoreProduct` exists for the mistake case.
    await productsService.softDeleteProduct(supabase, input.id);

    revalidateCatalog();
    revalidatePath(routes.admin.products);

    return { deleted: true };
  },
);
