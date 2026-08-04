import "server-only";

import { createClient } from "@/supabase/server";
import { pick } from "@/lib/i18n/translations";
import { logger } from "@/lib/logger";
import type { Locale } from "@/lib/site-config";
import type { Brand, Category, Product, ProductSummary } from "@/types/catalog";

import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as productsService from "@/services/products.service";

/**
 * The storefront's read facade.
 *
 * Pages import **only** from here. It is the one place that:
 *
 *  1. creates the request-scoped Supabase client, so no page does;
 *  2. calls the services, which are the only things that touch the database;
 *  3. maps their database-shaped results onto the view models in
 *     `types/catalog.ts`, so components never change when a column does.
 *
 * This is a *caller* of services, not a service — which is why it may create a
 * client where `services/*.service.ts` deliberately may not (see
 * `services/README.md`). Keeping that decision in one file is what stops a page
 * from quietly picking the service-role client and bypassing RLS.
 *
 * ---
 *
 * **The fixture fallback.** There is no Supabase project yet (**D-18**), so
 * every query below fails. Rather than leave the storefront blank, an
 * unreachable database falls back to `mocks/` — but only in development, only
 * with a logged warning naming the failure, and never as a silent degrade:
 *
 *   * In production the error propagates to the error boundary. A shop that
 *     renders yesterday's fixtures when its database is down is worse than one
 *     that says it is broken — it takes orders it cannot fulfil.
 *   * `NODE_ENV` is inlined at build time, so the production bundle contains
 *     `false` and the fallback branch is unreachable in a deployed build. Same
 *     mechanism as ADR-45.
 *
 * Delete the fallback the day a project exists; the services above it do not
 * change.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Runs a database read, falling back to fixtures in development.
 *
 * The fixtures are imported lazily so they are only pulled into the graph when
 * the fallback actually fires — a production build never loads `mocks/`.
 */
async function withFixtureFallback<T>(
  what: string,
  read: () => Promise<T>,
  fixture: () => Promise<T>,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (IS_PRODUCTION) throw error;

    logger.warn(
      `[catalog] "${what}" fell back to fixtures — the database is unreachable. ` +
        `This never happens in production; there it fails.`,
      { cause: error instanceof Error ? error.message : String(error) },
    );

    return fixture();
  }
}

// -----------------------------------------------------------------------------
// Mapping: service shapes → the view models components already take
// -----------------------------------------------------------------------------
// The storefront's `ProductSummary` carries three fields the schema has no
// column for — `rating`, `reviewCount` and `badges`. Reviews arrive with the
// commerce phase and badges are derived, so they are filled from what does
// exist rather than invented: a featured product gets the `bestseller` badge, a
// low stock level gets `low-stock`, and the rating is zero until there is a
// `reviews` table to aggregate. Recorded as **K-17**.

function toBadges(item: {
  isFeatured: boolean;
  stockOnHand: number;
}): ProductSummary["badges"] {
  const badges: ProductSummary["badges"] = [];

  if (item.isFeatured) badges.push("bestseller");
  if (item.stockOnHand > 0 && item.stockOnHand <= 5) badges.push("low-stock");

  return badges;
}

function toSummary(
  item: productsService.ProductListItem,
  locale: Locale,
  categorySlug: string,
): ProductSummary {
  return {
    id: item.id,
    // The slug is per locale now (ADR-52), so the link a component renders is
    // the one for the language being read.
    slug: pick(item.slug, locale),
    sku: item.sku,
    name: item.name,
    brand: item.brand?.name ?? "",
    category: categorySlug,
    image: "",
    imageAlt: item.name,
    priceCents: item.priceCents,
    salePriceCents: item.salePriceCents,
    rating: 0,
    reviewCount: 0,
    stock: item.stockOnHand,
    badges: toBadges(item),
  };
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export async function listCategories(locale: Locale): Promise<Category[]> {
  return withFixtureFallback(
    "listCategories",
    async () => {
      const supabase = await createClient();
      const rows = await categoriesService.listCategories(supabase, {
        visibleOnly: true,
      });
      const counts = await categoriesService.countProductsByCategory(supabase);

      return rows.map((row) => ({
        slug: pick(row.slug, locale),
        name: row.name,
        description: row.description,
        productCount: counts.get(row.id) ?? 0,
      }));
    },
    async () => (await import("@/mocks/catalog")).categories,
  );
}

export async function listBrands(): Promise<Brand[]> {
  return withFixtureFallback(
    "listBrands",
    async () => {
      const supabase = await createClient();
      const rows = await brandsService.listBrands(supabase, {
        visibleOnly: true,
      });
      const counts = await brandsService.countProductsByBrand(supabase);

      return rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        monogram: row.name.slice(0, 2).toUpperCase(),
        productCount: counts.get(row.id) ?? 0,
      }));
    },
    async () => (await import("@/mocks/catalog")).brands,
  );
}

/** Resolves a category id to its localized slug, for the summary mapping. */
async function categorySlugs(locale: Locale): Promise<Map<string, string>> {
  const supabase = await createClient();
  const rows = await categoriesService.listCategories(supabase);

  return new Map(rows.map((row) => [row.id, pick(row.slug, locale)]));
}

export async function listFeaturedProducts(
  locale: Locale,
): Promise<ProductSummary[]> {
  return withFixtureFallback(
    "listFeaturedProducts",
    async () => {
      const supabase = await createClient();
      const slugs = await categorySlugs(locale);
      const rows = await productsService.listFeatured(supabase);

      return rows.map((row) =>
        toSummary(row, locale, slugs.get(row.categoryId ?? "") ?? ""),
      );
    },
    async () => (await import("@/mocks/catalog")).featuredProducts,
  );
}

export async function listDealProducts(
  locale: Locale,
): Promise<ProductSummary[]> {
  return withFixtureFallback(
    "listDealProducts",
    async () => {
      const supabase = await createClient();
      const slugs = await categorySlugs(locale);
      const rows = await productsService.listDeals(supabase);

      return rows.map((row) =>
        toSummary(row, locale, slugs.get(row.categoryId ?? "") ?? ""),
      );
    },
    async () => (await import("@/mocks/catalog")).dealProducts,
  );
}

/**
 * The catalog listing.
 *
 * Filtering and search happen **in the query** — the mock-backed version
 * filtered an array in memory, which is the thing that does not survive 50,000
 * products (**D-2**).
 */
export async function listProducts(
  locale: Locale,
  options: { categorySlug?: string; query?: string } = {},
): Promise<ProductSummary[]> {
  return withFixtureFallback(
    "listProducts",
    async () => {
      const supabase = await createClient();
      const categories = await categoriesService.listCategories(supabase);
      const slugs = new Map(
        categories.map((row) => [row.id, pick(row.slug, locale)]),
      );

      const categoryId = options.categorySlug
        ? categories.find(
            (row) => pick(row.slug, locale) === options.categorySlug,
          )?.id
        : undefined;

      const { rows } = await productsService.listProducts(supabase, {
        status: "active",
        visibility: "public",
        categoryId,
        search: options.query,
        locale,
        pageSize: 60,
      });

      return rows.map((row) =>
        toSummary(row, locale, slugs.get(row.categoryId ?? "") ?? ""),
      );
    },
    async () => {
      const { products } = await import("@/mocks/catalog");
      const needle = options.query?.toLocaleLowerCase(locale);

      return products.filter((product) => {
        if (options.categorySlug && product.category !== options.categorySlug) {
          return false;
        }
        if (!needle) return true;

        return (
          product.name[locale].toLocaleLowerCase(locale).includes(needle) ||
          product.sku.toLocaleLowerCase(locale).includes(needle) ||
          product.brand.toLocaleLowerCase(locale).includes(needle)
        );
      });
    },
  );
}

export async function getProductBySlug(
  locale: Locale,
  slug: string,
): Promise<Product | null> {
  return withFixtureFallback(
    "getProductBySlug",
    async () => {
      const supabase = await createClient();
      const detail = await productsService.getProductBySlug(
        supabase,
        locale,
        slug,
      );
      const slugs = await categorySlugs(locale);

      return {
        ...toSummary(detail, locale, slugs.get(detail.categoryId ?? "") ?? ""),
        shortDescription: detail.shortDescription,
        description: detail.description,
        warrantyMonths: detail.warrantyMonths ?? 0,
        specs: detail.specifications.map((spec) => ({
          group: spec.spec_group,
          name: spec.name,
          value: spec.value,
          unit: spec.unit,
        })),
      } satisfies Product;
    },
    async () =>
      (await import("@/mocks/catalog")).getProductBySlug(slug) ?? null,
  );
}

export async function listProductsByCategory(
  locale: Locale,
  categorySlug: string,
): Promise<ProductSummary[]> {
  return listProducts(locale, { categorySlug });
}
