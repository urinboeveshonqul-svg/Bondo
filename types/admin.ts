/**
 * View models for the admin interface.
 *
 * Same contract as `types/catalog.ts` and for the same reason: components are
 * typed against these, not against `mocks/admin.ts`, so wiring services in
 * changes the data source and nothing else.
 *
 * Where a shape corresponds to a Phase 2 table it is named after it and carries
 * the same field names, so the eventual mapper is a rename-free projection.
 * Declarations only — no runtime code (ADR-9).
 */

import type { Permission, RoleKey } from "@/lib/admin/permissions";
import type { Enums } from "@/types/database";
import type {
  LocalizedText,
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
  ProductVisibility,
  VariantOption,
} from "@/types/catalog";

/**
 * A product as the admin edits it.
 *
 * Composed on top of the storefront's `Product` rather than replacing it, so
 * adding an editor field cannot change what the storefront renders. The
 * storefront reads a published projection; this is the whole record.
 */
export type AdminProduct = Product & {
  status: ProductStatus;
  /**
   * Separate from `status`, because the schema keeps them separate: "is the work
   * finished" and "should anyone see it" are different questions (**K-16**).
   */
  visibility: ProductVisibility;
  isFeatured: boolean;
  /** ISO 8601. Set and in the future means "publish then" — see `publishState`. */
  scheduledFor: string | null;
  publishedAt: string | null;
  images: readonly ProductImage[];
  variantOptions: readonly VariantOption[];
  variants: readonly ProductVariant[];
  seo: SeoFields;
  /** Free-form synonyms a shopper might search for. Not localized: search terms. */
  searchKeywords: readonly string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

/** Mirrors `public.admins` joined to `public.profiles` and `user_roles`. */
export type AdminUser = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  jobTitle: string;
  roles: readonly RoleKey[];
  isActive: boolean;
  /** ISO 8601. `null` for an admin who has never signed in. */
  lastSeenAt: string | null;
  createdAt: string;
};

/**
 * The signed-in administrator, with permissions already resolved.
 *
 * Resolved once in the admin layout and passed down, rather than each component
 * recomputing the union from roles — one place decides what someone can do.
 */
export type AdminSession = {
  user: AdminUser;
  permissions: ReadonlySet<Permission>;
};

/** Mirrors `public.roles`. `isSystem` rows are trigger-protected from rename. */
export type AdminRole = {
  key: RoleKey;
  name: LocalizedText;
  description: LocalizedText;
  isSystem: boolean;
  memberCount: number;
};

// -----------------------------------------------------------------------------
// Orders and customers
// -----------------------------------------------------------------------------

/**
 * Order status.
 *
 * **The exception expired.** This was a hand-written union while there was no
 * `orders` table, declared in `scripts/check-enums.mjs` so it would be found
 * again. `20260809001000_orders_and_reviews.sql` created the enum, so it now
 * derives — and its old values (`pending`, `paid`, `fulfilled`, `refunded`) are
 * gone, because they described a payment this shop does not take (ADR-63).
 */
export type OrderStatus = Enums<"order_status">;

export type AdminOrder = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  /** Integer minor units (ADR-2). */
  totalCents: number;
  itemCount: number;
  placedAt: string;
};

export type AdminCustomer = {
  id: string;
  fullName: string;
  email: string;
  initials: string;
  orderCount: number;
  totalSpentCents: number;
  createdAt: string;
};

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------

/**
 * Why stock moved — **derived from the database** (CLAUDE.md § 12).
 *
 * Previously a hand-written union offering `damage` and `recount`, neither of
 * which the enum has, while missing `correction`, which it does (**K-16**). The
 * interface was offering an operator two reasons the insert would have rejected.
 *
 * The ledger is append-only and trigger-enforced (ADR-27): stock is never
 * overwritten, only moved, so the reason *is* the audit trail.
 */
export type MovementReason = Enums<"inventory_movement_type">;

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  reason: MovementReason;
  /** Signed. Negative removes stock. */
  quantityDelta: number;
  quantityAfter: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
};

export type InventoryRecord = {
  productId: string;
  productName: string;
  sku: string;
  brand: string;
  quantityOnHand: number;
  /** Declared in the schema, written by nothing until checkout lands (D-10). */
  quantityReserved: number;
  lowStockThreshold: number;
};

// -----------------------------------------------------------------------------
// Storefront content
// -----------------------------------------------------------------------------

/**
 * A homepage band. `type` selects the renderer; `ref` points at whatever the
 * renderer needs — a category slug for a rail, a banner id for a hero.
 *
 * Ordering is an explicit integer rather than array position because it has to
 * survive a round trip through the database, where row order is not a thing.
 */
export type HomepageSectionType =
  | "hero"
  | "featured"
  | "brands"
  | "category-rail"
  | "deals"
  | "value-props"
  | "reviews"
  | "newsletter";

export type HomepageSection = {
  id: string;
  type: HomepageSectionType;
  title: LocalizedText;
  subtitle: LocalizedText;
  ref: string | null;
  position: number;
  isVisible: boolean;
};

/** Mirrors `public.site_banners`. */
export type Banner = {
  id: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  ctaLabel: LocalizedText;
  ctaHref: string;
  isVisible: boolean;
  /** ISO 8601, or `null` for "live now" / "no end". */
  startsAt: string | null;
  endsAt: string | null;
};

export type ContentPage = {
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  seo: SeoFields;
  isPublished: boolean;
  updatedAt: string;
  updatedBy: string;
};

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

/** Mirrors `public.settings`, which is a key/value store grouped by prefix. */
export type StoreSettings = {
  store: {
    name: string;
    tagline: LocalizedText;
    supportEmail: string;
    supportPhone: string;
    addressLine: LocalizedText;
  };
  commerce: {
    /** ISO 4217. One store-wide currency (ADR-2, D-9). */
    currency: string;
    taxRatePercent: number;
    taxInclusivePricing: boolean;
    freeDeliveryThresholdCents: number;
    flatDeliveryFeeCents: number;
  };
  email: {
    senderName: string;
    senderAddress: string;
    lowStockAlerts: boolean;
    orderNotifications: boolean;
  };
  social: {
    x: string;
    youtube: string;
    linkedin: string;
    github: string;
  };
  branding: {
    logoPath: string | null;
    faviconPath: string | null;
  };
  /** Seven entries, Monday first. `null` closed. */
  businessHours: readonly BusinessDay[];
};

export type BusinessDay = {
  /** 1 = Monday … 7 = Sunday, matching ISO 8601. */
  day: number;
  opens: string | null;
  closes: string | null;
};

// -----------------------------------------------------------------------------
// Audit and activity
// -----------------------------------------------------------------------------

export type AuditAction = "create" | "update" | "delete" | "login" | "adjust";

/** Mirrors `public.audit_logs`, which is append-only even to `service_role`. */
export type AuditEntry = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityLabel: string;
  actorName: string;
  actorInitials: string;
  summary: LocalizedText;
  createdAt: string;
};

export type AdminNotification = {
  id: string;
  kind: "low-stock" | "order" | "review" | "system";
  title: LocalizedText;
  body: LocalizedText;
  href: string | null;
  createdAt: string;
  isRead: boolean;
};

// -----------------------------------------------------------------------------
// Shared editor shapes
// -----------------------------------------------------------------------------

/**
 * Twitter/X card layout — **derived from the database** (CLAUDE.md § 12).
 *
 * `null` on a record means "inherit the store default", which is what the
 * nullable column means too.
 */
export type TwitterCard = Enums<"twitter_card">;

/**
 * Everything a crawler or a share card reads, for one record.
 *
 * Every field here is a column on that record's **translation** row, added by
 * `20260804001000_localization.sql` and `20260805001000_social_metadata.sql`.
 * The shape is one panel's worth of fields rather than one table's, because
 * `ModuleSeoPanel` renders all of it and four modules use that panel.
 *
 * `slug` is `null` for modules whose records carry a single shared slug on the
 * parent row — brands, where the name is a trademark and identical in all three
 * languages.
 *
 * `ogImagePath` and `twitterCard` are single values even though the schema
 * stores them per locale: a large card in English and a small one in Russian is
 * an inconsistency rather than a translation. The service writes the same value
 * to each translation row, and the columns stay per-locale so the distinction is
 * available the day a store needs it.
 */
export type SeoFields = {
  /** Per-locale URL segment, or `null` when the module has one shared slug. */
  slug: LocalizedText | null;
  metaTitle: LocalizedText;
  metaDescription: LocalizedText;
  /** Free-form keywords, one per entry. Not localized — they are search terms. */
  keywords: readonly string[];
  /** Absolute, or empty to let the storefront emit its own self-referential one. */
  canonicalUrl: LocalizedText;
  /** Falls back to `metaTitle`, then to the record's name. */
  ogTitle: LocalizedText;
  /** Falls back to `metaDescription`, then to the record's description. */
  ogDescription: LocalizedText;
  /** A storage object path inside the module's bucket, never a URL. */
  ogImagePath: string | null;
  twitterCard: TwitterCard | null;
};

/** A point in a time series, used by the dashboard charts. */
export type SeriesPoint = {
  /** ISO 8601 date, no time. */
  date: string;
  value: number;
};
