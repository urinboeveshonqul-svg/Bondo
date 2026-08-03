/**
 * View models for the storefront UI.
 *
 * These describe what a component needs to render, not what the database
 * stores. Phase 3A builds the interface against these shapes and feeds them
 * from `mocks/`; the wiring phase replaces that source with services that map
 * `Tables<"products">` onto exactly these types. Components should not change
 * when the data starts arriving from Supabase — that is the whole point of
 * declaring them separately rather than rendering database rows directly.
 *
 * Money is integer minor units throughout (ADR-2), matching `price_cents` in
 * the schema, so `formatPrice()` works on these unchanged.
 *
 * Declarations only — the derived helpers live in `utils/catalog.ts` (ADR-9).
 */

export type ProductBadge = "new" | "bestseller" | "low-stock";

/** Mirrors `public.product_specifications` minus the ordering columns. */
export type ProductSpec = {
  group: string | null;
  name: string;
  value: string;
  unit: string | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  /** Storage path today; a real Supabase Storage key once wired. */
  image: string;
  imageAlt: string;
  priceCents: number;
  /** Present only while a promotion is running, and always below `priceCents`. */
  salePriceCents: number | null;
  rating: number;
  reviewCount: number;
  stock: number;
  badges: ProductBadge[];
};

export type Product = ProductSummary & {
  shortDescription: string;
  description: string;
  specs: ProductSpec[];
  warrantyMonths: number;
};

export type Brand = {
  slug: string;
  name: string;
  /** Two-to-four character monogram. Real logos arrive with Storage. */
  monogram: string;
  productCount: number;
};

export type Category = {
  slug: string;
  name: string;
  description: string;
  productCount: number;
};

export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  title: string;
  body: string;
  productName: string;
  verified: boolean;
};

/** Stock bands the UI reacts to, so the thresholds live in one place. */
export type StockLevel = "out-of-stock" | "low" | "in-stock";

export type Discount = {
  percent: number;
  savingCents: number;
};
