import "server-only";

import { cache } from "react";
import { unstable_rethrow } from "next/navigation";

import { createClient } from "@/supabase/server";
import { SORT_QUERY, type CatalogQuery } from "@/lib/catalog/search-params";
import { isAppError } from "@/lib/errors";
import { pick, toLocalizedText } from "@/lib/i18n/translations";
import { logger } from "@/lib/logger";

/**
 * How many products a listing page shows.
 *
 * `settings.catalog.products_per_page` is 24 and is the value this should read
 * once the settings service is wired to the storefront; until then the constant
 * matches it rather than diverging from it silently.
 */
export const CATALOG_PAGE_SIZE = 24;
import type { Locale } from "@/lib/site-config";
import type {
  Brand,
  Category,
  CategoryNavItem,
  Product,
  ProductSummary,
  Review,
} from "@/types/catalog";

import type { StoreContact } from "@/components/content/store-contact";
import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as contentPagesService from "@/services/content-pages.service";
import type { ContentPage } from "@/services/content-pages.service";
import * as settingsService from "@/services/settings.service";
import * as productsService from "@/services/products.service";
import * as reviewsService from "@/services/reviews.service";
import { BUCKETS, publicUrl } from "@/services/storage.service";
import * as highlightsService from "@/services/service-highlights.service";
import type { ServiceHighlight } from "@/services/service-highlights.service";

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
    // Next.js control-flow signals are thrown, not returned — including
    // `DynamicServerError`, which `cookies()` raises during prerendering so the
    // route can bail out to dynamic rendering. Returning fixtures for one would
    // prerender a page that must not be prerendered. Production rethrows
    // everything anyway; this is what makes development behave the same way.
    unstable_rethrow(error);

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
// `ProductSummary` carries `rating`, `reviewCount` and `badges`, none of which
// is a column.
//
// **`rating` and `reviewCount` are zero, and stay zero here.** `product_reviews`
// exists now, but aggregating it per product on a listing would be a query per
// card. A product's own rating is rendered from `getReviewSummary` on its detail
// page; a card shows no stars until the aggregate is denormalised, and showing
// an invented number would be worse than showing none.
//
// **`low-stock` is gone.** It read a stock level to tell a shopper to hurry, and
// this shop does not track stock — a published product is orderable, full stop.
// A badge derived from a number nobody maintains is a lie with a countdown on
// it. `bestseller` stays because `is_featured` is a real column an operator
// sets deliberately.

function toBadges(item: { isFeatured: boolean }): ProductSummary["badges"] {
  return item.isFeatured ? ["bestseller"] : [];
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

/**
 * The raw category rows, fetched **once per request**.
 *
 * Nearly every read below needs the category list — to resolve a slug to an id,
 * to map a product's `category_id` back to a URL, or to build the menu — and
 * each was fetching it again. On a page with several product rails that is one
 * full category query per rail, which is the N+1 this facade exists to avoid.
 *
 * `cache()` is per-request memoisation, not a cross-request cache: which
 * categories a caller may see depends on their RLS session (ADR-12).
 */
const readCategoryRows = cache(async () => {
  const supabase = await createClient();

  return categoriesService.listCategories(supabase);
});

export async function listCategories(locale: Locale): Promise<Category[]> {
  return withFixtureFallback(
    "listCategories",
    async () => {
      const supabase = await createClient();
      const [all, counts] = await Promise.all([
        readCategoryRows(),
        categoriesService.countProductsByCategory(supabase),
      ]);

      return all
        .filter((row) => row.isVisible)
        .map((row) => ({
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
  const rows = await readCategoryRows();

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
      const categories = await readCategoryRows();
      const slugs = new Map(
        categories.map((row) => [row.id, pick(row.slug, locale)]),
      );

      const selected = options.categorySlug
        ? categories.find(
            (row) => pick(row.slug, locale) === options.categorySlug,
          )
        : undefined;

      /**
       * The whole subtree, not just the category that was clicked.
       *
       * Products are filed against a leaf — a graphics card is in "Graphics
       * cards", never in "Components" — so filtering a **department** by its own
       * id would return nothing and the twelve top-level links would all look
       * like empty shops. `categories.path` is the trigger-maintained
       * root-to-self chain (ADR-26), so "is this category at or below the
       * selected one" is a containment test on an array that has already been
       * fetched, rather than a recursive query.
       *
       * Correct at any depth, because `path` is.
       */
      const categoryIds = selected
        ? categories
            .filter((row) => row.path.includes(selected.id))
            .map((row) => row.id)
        : undefined;

      const { rows } = await productsService.listProducts(supabase, {
        status: "active",
        visibility: "public",
        categoryIds,
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

/** One page of the catalog listing, plus everything its chrome needs. */
export type CatalogPage = {
  products: ProductSummary[];
  /** Exact, from the database. Never estimated and never invented. */
  total: number;
  page: number;
  pageCount: number;
  /** Brands that have at least one product, for the filter panel. */
  brands: { slug: string; name: string; productCount: number }[];
  /** The lowest and highest list price in the catalog, in minor units. */
  priceRange: { min: number; max: number } | null;
};

/**
 * The catalog listing.
 *
 * One read for the whole page: the products, the exact count, the brands the
 * filter panel offers and the price bounds it suggests.
 *
 * **The brand list is not "every brand".** It is the brands that actually have
 * products, because a filter offering a brand that returns nothing is a filter
 * that teaches shoppers not to trust it. With an empty catalog that list is
 * empty and the panel says so, which is the honest state rather than a column
 * of checkboxes that all lead nowhere.
 *
 * `categoryIds` resolves the whole subtree from `path` (ADR-74), so choosing a
 * department finds the products filed under its subcategories.
 */
export async function listCatalog(
  locale: Locale,
  query: CatalogQuery,
): Promise<CatalogPage> {
  const supabase = await createClient();

  const [categories, brandRows, counts] = await Promise.all([
    readCategoryRows(),
    brandsService.listBrands(supabase, { visibleOnly: true }),
    brandsService.countProductsByBrand(supabase),
  ]);

  const slugs = new Map(
    categories.map((row) => [row.id, pick(row.slug, locale)]),
  );

  const selected = query.category
    ? categories.find((row) => pick(row.slug, locale) === query.category)
    : undefined;

  const categoryIds = selected
    ? categories
        .filter((row) => row.path.includes(selected.id))
        .map((r) => r.id)
    : undefined;

  const brandIds = query.brands.length
    ? brandRows
        .filter((brand) => query.brands.includes(brand.slug))
        .map((brand) => brand.id)
    : undefined;

  const sort = SORT_QUERY[query.sort];

  const { rows, total, pageCount, page } = await productsService.listProducts(
    supabase,
    {
      status: "active",
      visibility: "public",
      categoryIds,
      // A brand slug that matches nothing must return nothing, not everything.
      // Without this, a typed-in `?brand=nope` would silently drop the filter.
      brandIds: query.brands.length ? (brandIds ?? []) : undefined,
      // Major units in the URL, minor units in the column (ADR-2).
      minPriceCents:
        query.minPrice !== undefined
          ? Math.round(query.minPrice * 100)
          : undefined,
      maxPriceCents:
        query.maxPrice !== undefined
          ? Math.round(query.maxPrice * 100)
          : undefined,
      onSaleOnly: query.onSale,
      search: query.q,
      locale,
      sort: sort.sort,
      direction: sort.direction,
      featuredFirst: sort.featuredFirst,
      page: query.page,
      pageSize: CATALOG_PAGE_SIZE,
    },
  );

  const withProducts = brandRows
    .map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      productCount: counts.get(brand.id) ?? 0,
    }))
    .filter((brand) => brand.productCount > 0);

  return {
    products: rows.map((row) =>
      toSummary(row, locale, slugs.get(row.categoryId ?? "") ?? ""),
    ),
    total,
    page,
    pageCount,
    brands: withProducts,
    priceRange: await readPriceRange(supabase),
  };
}

/**
 * The catalog's cheapest and dearest list price, in minor units.
 *
 * Two one-row queries rather than an aggregate, because PostgREST has no `min`
 * or `max` — ordering by price and taking the first row is the same answer for
 * the same cost. Used to label the price inputs with the real range instead of
 * a placeholder somebody made up.
 *
 * Returns `null` for an empty catalog, and the panel then renders the price
 * filter without bounds rather than "0 – 0".
 */
async function readPriceRange(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ min: number; max: number } | null> {
  const bound = async (ascending: boolean) => {
    const { data } = await supabase
      .from("products")
      .select("price_cents")
      .eq("status", "active")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("price_cents", { ascending })
      .limit(1)
      .maybeSingle();

    return data?.price_cents ?? null;
  };

  const [min, max] = await Promise.all([bound(true), bound(false)]);

  return min === null || max === null ? null : { min, max };
}

/**
 * One product by its localized slug, or `null` when there is no such product.
 *
 * **`null` means "no such product"; a throw means "the catalog is broken".**
 * That distinction is the whole of this function, and it used not to exist:
 * `productsService.getProductBySlug` raises `notFoundOrForbidden` for a missing
 * row, this returned it unchanged despite the `| null` in its own signature,
 * and the page's `if (!product) notFound()` therefore never ran. `readCatalog`
 * caught the `AppError`, logged "page read failed — rendering the unavailable
 * state" and rendered `CatalogUnavailable` — so every unknown product URL
 * answered **200** with "we could not load the catalog", when the truth was a
 * 404 and "this product does not exist".
 *
 * Two things were wrong with that, not one: the status invited dead product
 * URLs into the search index, and the message blamed the shop's infrastructure
 * for a typo in a link.
 *
 * Only `not_found` is converted. A `forbidden`, a timeout or a connection
 * failure still throws, because those genuinely are "the catalog is
 * unavailable" and must not be disguised as an empty shelf.
 */
export async function getProductBySlug(
  locale: Locale,
  slug: string,
): Promise<Product | null> {
  return withFixtureFallback(
    "getProductBySlug",
    async () => {
      const supabase = await createClient();
      const detail = await productsService
        .getProductBySlug(supabase, locale, slug)
        .catch((error: unknown) => {
          if (isAppError(error) && error.code === "not_found") return null;
          throw error;
        });

      if (!detail) return null;
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

/**
 * Runs a page's catalog reads, returning `null` when the catalog is unavailable.
 *
 * **Why a page may not simply `await` and throw.** An exception escaping a
 * Server Component during the initial render aborts the shell before it flushes,
 * and React cannot then render the segment's `error.tsx` into a document that
 * does not exist — Next falls back to `app/global-error.tsx`, which replaces the
 * whole page with an unbranded, unlocalized document. Verified by probe: a bare
 * `throw new Error()` at the top of `app/[locale]/page.tsx` produced
 * `<html id="__next_error__">`, never the route boundary.
 *
 * The one thing that changes that is a Suspense boundary above the throw — and
 * that is worse, not better: `app/[locale]/products/loading.tsx` opens one, so
 * the failing listing flushed its skeleton and answered **200** with no content
 * at all. A permanent 200 on a broken page is the soft-error ADR-41 exists to
 * prevent, applied to errors instead of 404s.
 *
 * So the failure is handled where it happens. A page that gets `null` renders
 * `CatalogUnavailable` — inside its own chrome, in the visitor's language, with
 * the navigation still working — and the real exception goes to the server log
 * with its stack.
 *
 * **This is not the fixture fallback and does not weaken it.** Nothing here
 * renders mock data, and nothing claims the shop is empty: "we could not load
 * the catalog" and "we have no products" are different sentences, and only the
 * first one is true when the database is unreachable.
 */
export async function readCatalog<T>(
  read: () => Promise<T>,
): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    // Control flow first, always — `notFound()` from a page inside `read` is a
    // 404 and must not be turned into "the catalog is down" (ADR-13).
    unstable_rethrow(error);

    logger.error(
      "[catalog] page read failed — rendering the unavailable state",
      error,
    );

    return null;
  }
}

/**
 * Categories for the site **chrome** — the header's menu and the footer column.
 *
 * This is the one read in the storefront that **cannot throw**, and the
 * exception is deliberate rather than a softening of the rule above it.
 *
 * `app/[locale]/layout.tsx` renders on every route under `/[locale]`: the home
 * page, the catalog, the admin, the account pages and the 404. An exception
 * thrown in a layout **cannot be caught by the error boundary beside it** —
 * `app/[locale]/error.tsx` renders *inside* this layout, so React escalates
 * past it to `app/global-error.tsx`, which replaces the entire document. One
 * failing query in the navigation menu therefore returned 500 for every URL on
 * the site, including pages that need no database at all. That is what happened;
 * see the entry in PROJECT_STATUS.md § Known issues (**K-18**).
 *
 * So the rule is scoped by what the data is *for*:
 *
 *  * **Page content fails loudly.** A catalog page that cannot reach the catalog
 *    is broken and says so, in the route boundary, inside the site chrome. It
 *    must not render an empty shop, because "we have no products" and "we cannot
 *    reach the database" are different sentences and only one of them is true.
 *  * **Chrome degrades.** A category menu is navigation, not content. Losing it
 *    costs a visitor a dropdown; taking the document down with it costs them the
 *    whole site, and costs the 404 page its ability to be a 404.
 *
 * The failure is logged at `error`, not swallowed at `warn`: an empty menu in
 * production means the database is unreachable, and nothing else on the page
 * will say so.
 */
/**
 * The newest customer reviews, for the home page.
 *
 * Degrades to an empty list rather than failing the page, and the reason is the
 * same one `listNavigationCategories` gives: this is a marketing rail, not page
 * content. A shop whose reviews rail is unreachable should still sell things.
 *
 * There is **no fixture fallback**. Reviews were the last fake thing on the
 * storefront, and a fixture here would put words in a customer's mouth — the one
 * kind of invented data that is not merely untidy but dishonest. Empty until
 * somebody who bought something writes one.
 */
export async function listRecentReviews(locale: Locale): Promise<Review[]> {
  try {
    const supabase = await createClient();
    const rows = await reviewsService.listRecentReviews(supabase);

    return rows.map((row) => {
      const name = row.author?.full_name?.trim() || "";

      return {
        id: row.id,
        author: name,
        // Two initials from whatever the customer gave us. A profile with no
        // name yields an empty avatar rather than a crash.
        initials:
          name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("") || "?",
        rating: row.rating,
        title: row.title,
        body: row.body,
        productName: pick(
          toLocalizedText(
            (row.product?.translations ?? []) as {
              locale: Locale;
              name: string;
            }[],
            "name",
          ),
          locale,
        ),
        createdAt: row.created_at,
      };
    });
  } catch (error) {
    unstable_rethrow(error);

    logger.error("[catalog] recent reviews unavailable", error, { locale });

    return [];
  }
}

/**
 * The service highlights shown under the hero.
 *
 * Degrades to an empty list, for the same reason the category menu does: this is
 * a trust band, and losing it costs a visitor six cards where taking the page
 * down costs them the shop. `ServiceHighlights` renders nothing for an empty
 * list, so the failure is a missing section rather than a broken one.
 *
 * No fixture fallback. The rows are reference data shipped by a migration, so
 * "empty" here means the migration has not been applied — which a fixture would
 * hide at exactly the moment somebody needs to notice it.
 */
export async function listServiceHighlights(): Promise<ServiceHighlight[]> {
  try {
    const supabase = await createClient();

    return await highlightsService.listHighlights(supabase, {
      visibleOnly: true,
    });
  } catch (error) {
    unstable_rethrow(error);

    logger.error("[catalog] service highlights unavailable", error);

    return [];
  }
}

/**
 * The navigation tree: every visible category, nested, in **one** query.
 *
 * This is what the mega menu, the mobile accordion and the footer all render,
 * and the shape of it is the performance decision:
 *
 *   * `listCategories` fetches every category **and** every translation row in a
 *     single PostgREST request through an embedded select. A menu that fetched
 *     a department's children when it opened would be twelve extra round trips;
 *     one that fetched translations per row would be three hundred.
 *   * `toCategoryTree` nests the result in memory. No recursive CTE, no query
 *     per level, and no cap on depth.
 *   * `countProductsByCategory` is the only other request, and
 *     `rollUpProductCounts` credits each department with its whole subtree
 *     rather than counting again per node.
 *
 * So the whole navigation costs **two** requests per render, regardless of how
 * many categories or how deep the tree goes.
 *
 * `cache()` deduplicates within a request. The layout already fetches once and
 * hands the result to the header and the footer, but a page that also wants the
 * tree — a category landing page, a sitemap — gets it for free rather than
 * paying for it a second time. It is per-request memoisation, not a cross-request
 * cache: the categories a caller may see depend on their RLS session, and a
 * cache that ignored that would serve one visitor's menu to another (ADR-12).
 */
const readNavigationTree = cache(
  async (locale: Locale): Promise<CategoryNavItem[]> => {
    const supabase = await createClient();

    const [all, directCounts] = await Promise.all([
      readCategoryRows(),
      categoriesService.countProductsByCategory(supabase),
    ]);

    // Filtered here rather than in the query, so this shares the one memoised
    // category read with every other caller instead of issuing a second,
    // near-identical `visibleOnly` fetch.
    const rows = all.filter((row) => row.isVisible);

    const counts = categoriesService.rollUpProductCounts(rows, directCounts);

    const toNavItem = (
      node: categoriesService.CategoryNode,
    ): CategoryNavItem => ({
      id: node.id,
      // Resolved here rather than in the component: the slug is per locale
      // (ADR-52) and a Client Component should not be choosing which one is the
      // URL.
      slug: pick(node.slug, locale),
      name: node.name,
      description: node.description,
      icon: node.icon,
      image: node.imagePath
        ? publicUrl(supabase, BUCKETS.siteAssets, node.imagePath)
        : "",
      isFeatured: node.isFeatured,
      productCount: counts.get(node.id) ?? 0,
      children: node.children.map(toNavItem),
    });

    return categoriesService.toCategoryTree(rows).map(toNavItem);
  },
);

/**
 * A business-information page — delivery, warranty, returns, contact, about.
 *
 * Page content, so it fails loudly: the caller wraps this in `readCatalog` and
 * renders the unavailable state rather than an empty page. There is no fixture
 * fallback, and there must not be — inventing a delivery policy in development
 * is exactly the failure this whole feature was written to avoid.
 */
export async function getInfoPage(key: string): Promise<ContentPage> {
  const supabase = await createClient();

  return contentPagesService.getContentPage(supabase, key);
}

/**
 * The shop's own contact details.
 *
 * Reads the public settings subset and picks the five contact keys out of it,
 * coercing anything that is not a non-empty string to `null`. That coercion is
 * load-bearing: `settings.value` is `jsonb`, so a key can legitimately hold
 * `null`, and a caller that trusted the type would render the word "null" as a
 * phone number.
 *
 * Degrades to all-null rather than throwing. A contact page that cannot reach
 * the settings table should still render its copy and say the details are not
 * available, because the copy is the part that tells the reader what to do.
 */
export async function getStoreContact(locale: Locale): Promise<StoreContact> {
  try {
    const supabase = await createClient();
    // Locale-aware: `store.address` and `store.hours` are prose and live in
    // `setting_translations`, so reading `settings.value` alone reports them
    // unset no matter how carefully an operator filled them in.
    const settings = await settingsService.getPublicSettingsForLocale(
      supabase,
      locale,
    );

    return {
      phone: settings["store.phone"] ?? null,
      telegram: settings["store.telegram"] ?? null,
      email: settings["store.support_email"] ?? null,
      address: settings["store.address"] ?? null,
      hours: settings["store.hours"] ?? null,
    };
  } catch (error) {
    unstable_rethrow(error);

    logger.error("[catalog] store contact settings unavailable", error);

    return {
      phone: null,
      telegram: null,
      email: null,
      address: null,
      hours: null,
    };
  }
}

export async function listCategoryNavigation(
  locale: Locale,
): Promise<CategoryNavItem[]> {
  try {
    return await readNavigationTree(locale);
  } catch (error) {
    // **Before anything else.** Next.js signals control flow by throwing —
    // `notFound()`, `redirect()`, and `DynamicServerError`, raised when
    // `cookies()` is reached during static prerendering so the route can bail
    // out to dynamic rendering. Catching that one told the build "no
    // categories" instead of "render this on demand", and the empty menu was
    // baked into the prerendered HTML permanently. Same failure as ADR-13, one
    // layer down.
    unstable_rethrow(error);

    logger.error(
      "[catalog] navigation categories unavailable — rendering the chrome without the menu",
      error,
      { locale },
    );

    return [];
  }
}
