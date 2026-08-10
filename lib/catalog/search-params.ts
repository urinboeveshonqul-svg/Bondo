/**
 * The catalog listing's URL state.
 *
 * Every control on the listing — the category row, the brand checkboxes, the
 * price box, the sort menu, the active-filter chips — reads and writes the
 * query string, and this module is the only thing that knows its shape. One
 * encoding, one parser, one builder: a chip that removes a brand and a checkbox
 * that adds one cannot disagree about how brands are spelled in a URL.
 *
 * **The URL is the state.** There is no client-side filter store, which is what
 * keeps the listing a Server Component: the page reads `searchParams`, queries
 * with them, and renders. A filter change is a navigation, so it is
 * shareable, bookmarkable, survives a reload and works with the back button —
 * none of which a `useState` filter panel gives you for free.
 *
 * Pure. No React, no Supabase, no env — it is imported by both a Server
 * Component and a Client Component, and by nothing that needs a request.
 */

/** What the sort menu offers. The values appear in URLs, so they are stable. */
export const CATALOG_SORTS = [
  "recommended",
  "price-asc",
  "price-desc",
  "newest",
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const DEFAULT_SORT: CatalogSort = "recommended";

/**
 * How each sort maps onto the service's query parameters.
 *
 * **There is deliberately no "by name".** A product's name lives on
 * `product_translations`, and PostgREST cannot order a parent by a column on a
 * to-many embedded row — `services/products.service.ts` says so at the top of
 * `listProducts`. Offering the option would produce a control that changes the
 * URL and never changes the order, which is worse than not offering it. It
 * comes back with a view or an RPC.
 */
export const SORT_QUERY: Record<
  CatalogSort,
  {
    sort: "price_cents" | "published_at" | "updated_at";
    direction: "asc" | "desc";
    featuredFirst?: boolean;
  }
> = {
  recommended: { sort: "published_at", direction: "desc", featuredFirst: true },
  "price-asc": { sort: "price_cents", direction: "asc" },
  "price-desc": { sort: "price_cents", direction: "desc" },
  newest: { sort: "published_at", direction: "desc" },
};

export type CatalogQuery = {
  /** Localized category slug, or `undefined` for the whole catalog. */
  category?: string;
  /** Brand slugs, always an array so callers never branch on one-vs-many. */
  brands: string[];
  /** **Major** units as the shopper typed them — the page converts (ADR-2). */
  minPrice?: number;
  maxPrice?: number;
  onSale: boolean;
  sort: CatalogSort;
  q?: string;
  page: number;
};

/** What Next.js hands a page as `searchParams`, before we make sense of it. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Repeated params arrive as an array, a single one as a string. Normalise. */
const all = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
};

/**
 * A positive number, or `undefined`.
 *
 * Anything else — a negative, a word, `Infinity`, an empty string — is dropped
 * rather than clamped. `searchParams` is user input that reaches a database
 * filter, and a value nobody can explain should not silently become one that
 * looks explicable.
 */
function positiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value.replace(/\s/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;

  return parsed;
}

export function parseCatalogQuery(params: RawSearchParams): CatalogQuery {
  const sort = first(params.sort);
  const min = positiveNumber(first(params.min));
  const max = positiveNumber(first(params.max));

  return {
    category: first(params.category) || undefined,
    brands: all(params.brand),
    // A reversed range returns nothing and looks broken. Swapping is the
    // charitable reading of "5000 to 100" and costs the shopper nothing.
    minPrice: min !== undefined && max !== undefined ? Math.min(min, max) : min,
    maxPrice: min !== undefined && max !== undefined ? Math.max(min, max) : max,
    onSale: first(params.sale) === "1",
    sort: (CATALOG_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as CatalogSort)
      : DEFAULT_SORT,
    q: first(params.q)?.trim() || undefined,
    page: Math.max(1, Math.trunc(positiveNumber(first(params.page)) ?? 1)),
  };
}

/**
 * Serialises a query back to a path.
 *
 * Defaults are **omitted**, not written: `?sort=recommended&page=1` and `?` are
 * the same listing, and emitting both means two URLs for one page and two cache
 * entries for one result.
 *
 * The path carries no locale prefix — `<Link>` from `@/i18n/navigation` adds it
 * (CLAUDE.md § 4).
 */
export function buildCatalogHref(
  query: CatalogQuery,
  basePath = "/products",
): string {
  const params = new URLSearchParams();

  if (query.category) params.set("category", query.category);
  for (const brand of query.brands) params.append("brand", brand);
  if (query.minPrice !== undefined) params.set("min", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("max", String(query.maxPrice));
  if (query.onSale) params.set("sale", "1");
  if (query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  if (query.page > 1) params.set("page", String(query.page));

  const search = params.toString();

  return search ? `${basePath}?${search}` : basePath;
}

/**
 * A copy of `query` with `patch` applied, reset to page 1.
 *
 * Every filter change resets the page, and that is the point of routing it
 * through one function: a shopper on page 4 who ticks a brand is asking for the
 * first page of the new result, and landing them on an empty page 4 is the
 * classic faceted-search bug.
 */
export function withCatalogQuery(
  query: CatalogQuery,
  patch: Partial<CatalogQuery>,
): CatalogQuery {
  return { ...query, ...patch, page: patch.page ?? 1 };
}

/** Adds or removes one brand slug. */
export function toggleBrand(query: CatalogQuery, slug: string): CatalogQuery {
  const brands = query.brands.includes(slug)
    ? query.brands.filter((entry) => entry !== slug)
    : [...query.brands, slug];

  return withCatalogQuery(query, { brands });
}

/** Everything except the category and the search term — what "clear" clears. */
export function clearCatalogFilters(query: CatalogQuery): CatalogQuery {
  return withCatalogQuery(query, {
    brands: [],
    minPrice: undefined,
    maxPrice: undefined,
    onSale: false,
  });
}

/**
 * Whether any *filter* is applied.
 *
 * The category and the search term are excluded on purpose: they are how the
 * shopper got here, not something they added on top, and a "clear filters"
 * control that also drops the category they clicked is a control that undoes
 * navigation. Sorting is excluded for the same reason — it changes the order,
 * not the set.
 */
export function hasActiveFilters(query: CatalogQuery): boolean {
  return (
    query.brands.length > 0 ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.onSale
  );
}
