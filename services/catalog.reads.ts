import "server-only";

import { unstable_rethrow } from "next/navigation";

import { createClient } from "@/supabase/server";
import { pick, toLocalizedText } from "@/lib/i18n/translations";
import { logger } from "@/lib/logger";
import type { Locale } from "@/lib/site-config";
import type {
  Brand,
  Category,
  Product,
  ProductSummary,
  Review,
} from "@/types/catalog";

import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as productsService from "@/services/products.service";
import * as reviewsService from "@/services/reviews.service";
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

export async function listNavigationCategories(
  locale: Locale,
): Promise<Category[]> {
  try {
    return await listCategories(locale);
  } catch (error) {
    // **Before anything else.** Next.js signals control flow by throwing:
    // `notFound()`, `redirect()`, and — the one that bit here —
    // `DynamicServerError`, raised when `cookies()` is reached during static
    // prerendering so the route can bail out to dynamic rendering. Catching it
    // told the build "no categories" instead of "render this on demand", and
    // the empty menu was then baked into the prerendered HTML permanently.
    // Same failure as ADR-13, one layer down. Caught by rebuilding and reading
    // the log, not by reasoning.
    unstable_rethrow(error);

    logger.error(
      "[catalog] navigation categories unavailable — rendering the chrome without the menu",
      error,
      { locale },
    );

    return [];
  }
}
