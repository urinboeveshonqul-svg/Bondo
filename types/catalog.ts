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
 * The `Locale` import is type-only and erases completely, so this module still
 * emits zero runtime code.
 */

import type { Locale } from "@/lib/site-config";
import type { Enums } from "@/types/database";

/**
 * Catalog copy, held per locale on the record itself.
 *
 * This is the deliberate counterpart to `messages/` (ADR-39). Interface chrome —
 * "Add to basket", "Out of stock" — is the same sentence on every page and lives
 * in a message file. Catalog copy is different for every row, is written by
 * merchandisers rather than developers, and changes without a deploy: it belongs
 * to the product, not to the build.
 *
 * Making it a required record of every locale means a product cannot be added in
 * one language only. TypeScript rejects it, which is the compile-time half of
 * "a feature is not done until all three languages exist".
 */
export type LocalizedText = Record<Locale, string>;

export type ProductBadge = "new" | "bestseller" | "low-stock";

/**
 * Mirrors `public.product_specifications` minus the ordering columns.
 *
 * `group` and `name` are translation keys into the `product` namespace
 * (`specs.groups.*`, `specs.names.*`), not free text. Specification labels are a
 * small controlled vocabulary reused across the whole catalog — "Capacity"
 * appears on memory, storage and batteries — so translating them once is both
 * less work and more consistent than carrying the same three translations on
 * every row.
 *
 * `value` is a union because specification values are genuinely two different
 * kinds of thing. "24", "GDDR6X", "AM5" and "3840 x 2160" are identifiers and
 * measurements that are the same string in every language — translating them
 * would be wrong, and storing three identical copies is noise. "Linear
 * mechanical" and "Brushed aluminium" are prose and must be translated. The
 * union lets each value be whichever it actually is, and the renderer resolves
 * one shape or the other.
 *
 * `unit` stays literal: SI symbols are not translated.
 */
export type ProductSpec = {
  group: string | null;
  name: string;
  value: string | LocalizedText;
  unit: string | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  sku: string;
  /**
   * Localized. A manufacturer's model number reads the same in every language —
   * "RTX 4090" is "RTX 4090" — but the words around it do not: Bondo's own
   * builds are "Gaming PC" in English and "Игровой компьютер" in Russian, and a
   * shopper searching in Uzbek should find the Uzbek phrasing. `modelName()` in
   * `mocks/catalog.ts` exists for the identical case so the three copies are
   * declared once rather than typed out.
   */
  name: LocalizedText;
  brand: string;
  category: string;
  /** Storage path today; a real Supabase Storage key once wired. */
  image: string;
  /** Alt text is content, not chrome — it describes this product specifically. */
  imageAlt: LocalizedText;
  priceCents: number;
  /** Present only while a promotion is running, and always below `priceCents`. */
  salePriceCents: number | null;
  rating: number;
  reviewCount: number;
  stock: number;
  badges: ProductBadge[];
};

export type Product = ProductSummary & {
  shortDescription: LocalizedText;
  description: LocalizedText;
  specs: ProductSpec[];
  warrantyMonths: number;
};

/**
 * Publishing state — **derived from the database**, not re-typed (CLAUDE.md § 12).
 *
 * This was a hand-written `"draft" | "published" | "hidden"` union until the
 * generated types arrived and showed the schema disagreeing on both counts
 * (**K-16**): the real enum is `draft | active | archived`, and whether a
 * product is *reachable* is a second column entirely.
 *
 * That separation is the schema being right. "Is this finished?" and "should
 * anyone see it?" are different questions: an `active` product set to `hidden`
 * is a live listing withheld — an end-of-line item kept for its URL, or a launch
 * staged behind a date — which one combined field cannot express.
 */
export type ProductStatus = Enums<"product_status">;

/** Whether a finished product is reachable. Orthogonal to `ProductStatus`. */
export type ProductVisibility = Enums<"product_visibility">;

/**
 * A product image. `position` orders the gallery and `isPrimary` picks the one
 * used on cards and in Open Graph tags — a separate flag rather than "position
 * 0" so reordering the gallery cannot silently change the card thumbnail.
 *
 * Mirrors `public.product_images`.
 */
export type ProductImage = {
  id: string;
  /** Storage path today; a Supabase Storage key once wired (D-12). */
  path: string;
  alt: LocalizedText;
  position: number;
  isPrimary: boolean;
};

/**
 * A purchasable configuration of a product — 16GB/512GB, or an RTX 5080 build.
 *
 * **There is no `product_variants` table yet** (**D-8**): the schema gives a
 * product one SKU, price and stock. This type is what the admin edits and what
 * that table has to store, so it is deliberately shaped as rows rather than as
 * a nested blob: `options` is the axis set that renders the picker, and every
 * commercial field is per-variant because price, stock and weight all differ
 * between a 512GB and a 2TB configuration.
 */
export type ProductVariant = {
  id: string;
  sku: string;
  /** Axis name → value, e.g. `{ memory: "32GB", storage: "1TB" }`. */
  options: Record<string, string>;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  /** Grams. Shipping needs it per configuration, not per product. */
  weightGrams: number;
  imagePath: string | null;
  isActive: boolean;
};

/** An axis a product varies on, with its allowed values in display order. */
export type VariantOption = {
  key: string;
  name: LocalizedText;
  values: readonly string[];
};

/**
 * `name` is not localized: a brand name is a trademark and renders identically
 * in every language. Transliterating "NVIDIA" into Cyrillic would make it
 * unsearchable and is not what the manufacturer's own Russian site does.
 */
export type Brand = {
  slug: string;
  name: string;
  /** Two-to-four character monogram. Real logos arrive with Storage. */
  monogram: string;
  productCount: number;
};

export type Category = {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  productCount: number;
};

/**
 * A category as the site navigation renders it.
 *
 * Recursive on purpose: `children` is the same type, so the mega menu and the
 * mobile accordion both handle **unlimited nesting** without either of them
 * knowing how deep the taxonomy currently goes. The shipped tree is two levels;
 * an operator adding a third needs no code change on either side.
 *
 * `slug` is already resolved to the reading locale — the slug is per-language
 * (ADR-52), so a component rendering a link must not have to pick one. `name`
 * stays localized because the navigation is rendered once and read by a Client
 * Component that knows the locale.
 *
 * `icon` is a lucide *name*, not a URL. `image` is a public Storage URL or `""`,
 * which is what an `<img>` needs and what "no image" looks like without a
 * placeholder standing in for a decision nobody made.
 */
export type CategoryNavItem = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  icon: string | null;
  image: string;
  isFeatured: boolean;
  productCount: number;
  children: CategoryNavItem[];
};

/**
 * Review text is localized here because these three are marketing copy standing
 * in for real reviews (ADR-36). **Real reviews are never translated** — they are
 * written by one customer in one language, and a translated review is no longer
 * that customer's words. When reviews come from the database they carry the
 * locale they were written in, and the UI labels that rather than rewriting it.
 */
/**
 * A customer review.
 *
 * **`title` and `body` are plain strings, not `LocalizedText`.** A review is
 * something a person wrote, in the language they wrote it in, and translating it
 * would be putting words in their mouth — the roadmap has said so since Phase
 * 3B. The row carries no locale column either: the text is displayed as typed,
 * to every visitor, in every language.
 *
 * There is no `verified` flag because there is nothing to flag. `product_reviews`
 * only accepts a row from a customer whose own order containing that product
 * reached `delivered`, enforced by RLS (ADR-66) — so every review that exists is
 * a verified purchase, and a badge distinguishing them would distinguish nothing.
 */
export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  title: string | null;
  body: string | null;
  productName: string;
  createdAt: string;
};

/** Stock bands the UI reacts to, so the thresholds live in one place. */
export type StockLevel = "out-of-stock" | "low" | "in-stock";

export type Discount = {
  percent: number;
  savingCents: number;
};
