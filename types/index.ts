/**
 * Cross-cutting type declarations.
 *
 * Types only — nothing in this folder emits runtime code, so importing from it
 * can never add a byte to a bundle. Runtime helpers live in `lib/`
 * (`lib/result.ts`, `lib/errors.ts`).
 *
 * Domain types (Product, Order, ...) are derived from `types/database.ts` once
 * the schema exists — they are never re-declared by hand. What lives here are
 * the transport and UI shapes that are not database rows.
 */

export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "./database";

/**
 * Offset pagination, as parsed from search params.
 *
 * Offset works for admin tables and short result sets. It does not work for
 * deep catalog browsing: `OFFSET 40000` makes Postgres walk and discard 40,000
 * rows, and an exact `COUNT(*)` over a large filtered set is its own scan. When
 * the catalog reaches that size, paginate the storefront by keyset (order by
 * `(sort_key, id)` and seek past the last row of the previous page) and use
 * Supabase's `count: "estimated"` for the total.
 */
export type PaginationParams = {
  page: number;
  perPage: number;
};

/** Envelope for any paginated list returned to the UI. */
export type Paginated<T> = {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

export type SortDirection = "asc" | "desc";

/**
 * Next.js 15 passes `params` and `searchParams` to page and layout components
 * as Promises. These aliases keep the signatures readable.
 */
export type PageParams<
  T extends Record<string, string> = Record<string, never>,
> = Promise<T>;

export type PageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
