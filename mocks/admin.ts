import { permissionsFor } from "@/lib/admin/permissions";
import type {
  AdminCustomer,
  AdminNotification,
  AdminOrder,
  AdminProduct,
  AdminRole,
  AdminSession,
  AdminUser,
  AuditEntry,
  Banner,
  ContentPage,
  HomepageSection,
  InventoryMovement,
  InventoryRecord,
  SeriesPoint,
  StoreSettings,
} from "@/types/admin";
import { products } from "@/mocks/catalog";

/**
 * TEMPORARY admin data — see `mocks/README.md` and ADR-36, extended by ADR-43.
 *
 * Deleted when the admin services land. Nothing outside `app/` and
 * `components/` may import this file.
 *
 * **Dates are derived from a fixed epoch, never from `Date.now()` at module
 * scope.** A mock that computes "3 hours ago" when the module loads produces a
 * different value on the server than on the client and hydration fails — and
 * during a static build it freezes whatever the build clock said. `daysAgo()`
 * is called with the same epoch everywhere, so every render agrees.
 */

/** Fixed reference point. Chosen, not sampled, so builds are reproducible. */
const EPOCH = Date.UTC(2026, 7, 4, 9, 0, 0);

function daysAgo(days: number, hours = 0): string {
  return new Date(EPOCH - days * 86_400_000 - hours * 3_600_000).toISOString();
}

function daysAhead(days: number): string {
  return new Date(EPOCH + days * 86_400_000).toISOString();
}

// -----------------------------------------------------------------------------
// Administrators
// -----------------------------------------------------------------------------

export const adminUsers: AdminUser[] = [
  {
    id: "a1",
    userId: "u-0000-0001",
    fullName: "Dilnoza Karimova",
    email: "dilnoza@bondo.uz",
    initials: "DK",
    jobTitle: "Store owner",
    roles: ["super_admin"],
    isActive: true,
    lastSeenAt: daysAgo(0, 1),
    createdAt: daysAgo(420),
  },
  {
    id: "a2",
    userId: "u-0000-0002",
    fullName: "Sardor Yusupov",
    email: "sardor@bondo.uz",
    initials: "SY",
    jobTitle: "Catalog manager",
    roles: ["catalog_manager"],
    isActive: true,
    lastSeenAt: daysAgo(0, 4),
    createdAt: daysAgo(300),
  },
  {
    id: "a3",
    userId: "u-0000-0003",
    fullName: "Nigora Abdullayeva",
    email: "nigora@bondo.uz",
    initials: "NA",
    jobTitle: "Warehouse lead",
    roles: ["inventory_manager"],
    isActive: true,
    lastSeenAt: daysAgo(1, 2),
    createdAt: daysAgo(210),
  },
  {
    id: "a4",
    userId: "u-0000-0004",
    fullName: "Timur Rashidov",
    email: "timur@bondo.uz",
    initials: "TR",
    jobTitle: "Content editor",
    roles: ["content_editor"],
    isActive: true,
    lastSeenAt: daysAgo(3),
    createdAt: daysAgo(150),
  },
  {
    id: "a5",
    userId: "u-0000-0005",
    fullName: "Kamila Tashkentova",
    email: "kamila@bondo.uz",
    initials: "KT",
    jobTitle: "Support agent",
    roles: ["support_agent"],
    isActive: true,
    lastSeenAt: daysAgo(0, 7),
    createdAt: daysAgo(90),
  },
  {
    id: "a6",
    userId: "u-0000-0006",
    fullName: "Bekzod Ismoilov",
    email: "bekzod@bondo.uz",
    initials: "BI",
    jobTitle: "Catalog manager",
    roles: ["catalog_manager", "inventory_manager"],
    isActive: false,
    lastSeenAt: daysAgo(64),
    createdAt: daysAgo(180),
  },
];

/**
 * The signed-in administrator.
 *
 * **There is no authentication yet** (K-1, K-2). This is a fixture standing in
 * for a Supabase session, and the admin layout resolves it exactly where it
 * will later `await getAdminSession()`. Swapping this for a real query is the
 * whole of the auth wiring for the interface.
 *
 * Deliberately `super_admin`, so the interface can be reviewed in full. Change
 * the index to see the permission-aware navigation drop modules — with
 * `catalog_manager` the Administration section disappears entirely.
 */
const SIGNED_IN_INDEX = 0;

export function getAdminSession(): AdminSession {
  const user = adminUsers[SIGNED_IN_INDEX] as AdminUser;

  return { user, permissions: permissionsFor(user.roles) };
}

export const adminRoles: AdminRole[] = [
  {
    key: "super_admin",
    name: {
      uz: "Bosh administrator",
      ru: "Суперадминистратор",
      en: "Super administrator",
    },
    description: {
      uz: "Barcha imkoniyatlarga cheklovsiz kirish.",
      ru: "Неограниченный доступ ко всем возможностям.",
      en: "Unrestricted access to every capability.",
    },
    isSystem: true,
    memberCount: 1,
  },
  {
    key: "catalog_manager",
    name: {
      uz: "Katalog menejeri",
      ru: "Менеджер каталога",
      en: "Catalog manager",
    },
    description: {
      uz: "Mahsulotlar, kategoriyalar va brendlarni boshqaradi.",
      ru: "Управляет товарами, категориями и брендами.",
      en: "Manages products, categories and brands.",
    },
    isSystem: true,
    memberCount: 2,
  },
  {
    key: "inventory_manager",
    name: {
      uz: "Ombor menejeri",
      ru: "Менеджер склада",
      en: "Inventory manager",
    },
    description: {
      uz: "Ombor harakatlarini qayd etadi va katalogni o'qiydi.",
      ru: "Фиксирует движения склада и читает каталог.",
      en: "Records stock movements and reads the catalog.",
    },
    isSystem: true,
    memberCount: 2,
  },
  {
    key: "support_agent",
    name: {
      uz: "Qo'llab-quvvatlash xodimi",
      ru: "Сотрудник поддержки",
      en: "Support agent",
    },
    description: {
      uz: "Mijozlar va katalogni o'qiydi. Hech narsani o'zgartirmaydi.",
      ru: "Читает клиентов и каталог. Ничего не изменяет.",
      en: "Reads customers and the catalog. Changes nothing.",
    },
    isSystem: true,
    memberCount: 1,
  },
  {
    key: "content_editor",
    name: {
      uz: "Kontent muharriri",
      ru: "Контент-редактор",
      en: "Content editor",
    },
    description: {
      uz: "Bannerlar va ochiq sozlamalarni boshqaradi.",
      ru: "Управляет баннерами и публичными настройками.",
      en: "Manages banners and public settings.",
    },
    isSystem: true,
    memberCount: 1,
  },
];

// -----------------------------------------------------------------------------
// Products, as the admin sees them
// -----------------------------------------------------------------------------

/**
 * Variant fixtures, keyed by product slug.
 *
 * Only three products carry variants, which is the realistic shape: a memory kit
 * has one configuration and a laptop has four. Building the editor against a
 * catalog where everything has variants hides the empty state.
 */
const VARIANTS: Record<
  string,
  Pick<AdminProduct, "variantOptions" | "variants">
> = {
  "lenovo-thinkpad-x1-carbon-gen-12": {
    variantOptions: [
      {
        key: "memory",
        name: { uz: "Xotira", ru: "Память", en: "Memory" },
        values: ["16GB", "32GB"],
      },
      {
        key: "storage",
        name: { uz: "Disk", ru: "Накопитель", en: "Storage" },
        values: ["512GB", "1TB"],
      },
    ],
    variants: [
      {
        id: "v-x1c-1",
        sku: "LAP-LEN-X1C-G12-16-512",
        options: { memory: "16GB", storage: "512GB" },
        priceCents: 189900,
        salePriceCents: null,
        stock: 3,
        weightGrams: 1090,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-x1c-2",
        sku: "LAP-LEN-X1C-G12-16-1T",
        options: { memory: "16GB", storage: "1TB" },
        priceCents: 209900,
        salePriceCents: 199900,
        stock: 5,
        weightGrams: 1090,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-x1c-3",
        sku: "LAP-LEN-X1C-G12-32-512",
        options: { memory: "32GB", storage: "512GB" },
        priceCents: 219900,
        salePriceCents: null,
        stock: 0,
        weightGrams: 1090,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-x1c-4",
        sku: "LAP-LEN-X1C-G12-32-1T",
        options: { memory: "32GB", storage: "1TB" },
        priceCents: 239900,
        salePriceCents: null,
        stock: 2,
        weightGrams: 1090,
        imagePath: null,
        isActive: true,
      },
    ],
  },
  "bondo-forge-rtx-4080-gaming-pc": {
    variantOptions: [
      {
        key: "gpu",
        name: { uz: "Videokarta", ru: "Видеокарта", en: "Graphics" },
        values: ["RTX 4060", "RTX 5070", "RTX 5080"],
      },
    ],
    variants: [
      {
        id: "v-forge-1",
        sku: "PC-FORGE-4060",
        options: { gpu: "RTX 4060" },
        priceCents: 179900,
        salePriceCents: 169900,
        stock: 4,
        weightGrams: 12400,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-forge-2",
        sku: "PC-FORGE-5070",
        options: { gpu: "RTX 5070" },
        priceCents: 249900,
        salePriceCents: 229900,
        stock: 2,
        weightGrams: 12800,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-forge-3",
        sku: "PC-FORGE-5080",
        options: { gpu: "RTX 5080" },
        priceCents: 329900,
        salePriceCents: null,
        stock: 0,
        weightGrams: 13100,
        imagePath: null,
        isActive: false,
      },
    ],
  },
  "bondo-atlas-workstation": {
    variantOptions: [
      {
        key: "memory",
        name: { uz: "Xotira", ru: "Память", en: "Memory" },
        values: ["128GB", "256GB"],
      },
    ],
    variants: [
      {
        id: "v-atlas-1",
        sku: "PC-ATLAS-WS-128",
        options: { memory: "128GB" },
        priceCents: 399900,
        salePriceCents: null,
        stock: 3,
        weightGrams: 18600,
        imagePath: null,
        isActive: true,
      },
      {
        id: "v-atlas-2",
        sku: "PC-ATLAS-WS-256",
        options: { memory: "256GB" },
        priceCents: 519900,
        salePriceCents: null,
        stock: 1,
        weightGrams: 18900,
        imagePath: null,
        isActive: true,
      },
    ],
  },
};

/** Products the merchandiser has not finished, so the list has real drafts. */
const STATUS_OVERRIDES: Record<
  string,
  Pick<AdminProduct, "status" | "scheduledFor">
> = {
  "razer-deathadder-v3-pro": { status: "hidden", scheduledFor: null },
  "asus-proart-display-pa279crv": {
    status: "published",
    scheduledFor: daysAhead(6),
  },
  "intel-core-i9-14900k": { status: "draft", scheduledFor: null },
};

/**
 * The admin's view of the catalog, projected from the storefront fixtures.
 *
 * Derived rather than duplicated: one product list, so a product edited in the
 * admin cannot disagree with the same product on the storefront. That is also
 * the relationship the real system has — one `products` table, two projections.
 */
export const adminProducts: AdminProduct[] = products.map((product, index) => {
  const override = STATUS_OVERRIDES[product.slug];
  const variantData = VARIANTS[product.slug];

  return {
    ...product,
    status: override?.status ?? "published",
    scheduledFor: override?.scheduledFor ?? null,
    publishedAt: override?.status === "draft" ? null : daysAgo(30 + index * 5),
    isFeatured: product.badges.includes("bestseller"),
    images: [
      {
        id: `${product.id}-img-1`,
        path: product.image,
        alt: product.imageAlt,
        position: 0,
        isPrimary: true,
      },
    ],
    variantOptions: variantData?.variantOptions ?? [],
    variants: variantData?.variants ?? [],
    seo: {
      metaTitle: product.shortDescription,
      metaDescription: product.description,
      keywords: [product.brand.toLowerCase(), product.category],
    },
    searchKeywords: [product.sku.toLowerCase(), product.brand.toLowerCase()],
    createdAt: daysAgo(120 - index * 3),
    updatedAt: daysAgo(index),
    createdBy: "Dilnoza Karimova",
    updatedBy: index % 2 === 0 ? "Sardor Yusupov" : "Dilnoza Karimova",
  };
});

export function getAdminProduct(id: string): AdminProduct | undefined {
  return adminProducts.find((p) => p.id === id || p.slug === id);
}

// -----------------------------------------------------------------------------
// Orders and customers
// -----------------------------------------------------------------------------

export const adminOrders: AdminOrder[] = [
  {
    id: "o1",
    reference: "BND-2841",
    customerName: "Aziz Rahimov",
    customerEmail: "aziz.rahimov@example.com",
    status: "paid",
    totalCents: 229900,
    itemCount: 1,
    placedAt: daysAgo(0, 2),
  },
  {
    id: "o2",
    reference: "BND-2840",
    customerName: "Malika Yusupova",
    customerEmail: "malika.y@example.com",
    status: "pending",
    totalCents: 42900,
    itemCount: 1,
    placedAt: daysAgo(0, 5),
  },
  {
    id: "o3",
    reference: "BND-2839",
    customerName: "Jasur Toshmatov",
    customerEmail: "jasur.t@example.com",
    status: "fulfilled",
    totalCents: 162800,
    itemCount: 3,
    placedAt: daysAgo(1, 3),
  },
  {
    id: "o4",
    reference: "BND-2838",
    customerName: "Elena Sokolova",
    customerEmail: "e.sokolova@example.com",
    status: "fulfilled",
    totalCents: 89900,
    itemCount: 1,
    placedAt: daysAgo(1, 9),
  },
  {
    id: "o5",
    reference: "BND-2837",
    customerName: "Rustam Nazarov",
    customerEmail: "rustam.n@example.com",
    status: "cancelled",
    totalCents: 149900,
    itemCount: 1,
    placedAt: daysAgo(2, 4),
  },
  {
    id: "o6",
    reference: "BND-2836",
    customerName: "Anna Petrova",
    customerEmail: "anna.petrova@example.com",
    status: "refunded",
    totalCents: 16900,
    itemCount: 1,
    placedAt: daysAgo(3, 1),
  },
  {
    id: "o7",
    reference: "BND-2835",
    customerName: "Shohruh Umarov",
    customerEmail: "shohruh.u@example.com",
    status: "fulfilled",
    totalCents: 399900,
    itemCount: 1,
    placedAt: daysAgo(4, 6),
  },
];

export const adminCustomers: AdminCustomer[] = [
  {
    id: "c1",
    fullName: "Aziz Rahimov",
    email: "aziz.rahimov@example.com",
    initials: "AR",
    orderCount: 4,
    totalSpentCents: 612400,
    createdAt: daysAgo(210),
  },
  {
    id: "c2",
    fullName: "Malika Yusupova",
    email: "malika.y@example.com",
    initials: "MY",
    orderCount: 2,
    totalSpentCents: 85800,
    createdAt: daysAgo(96),
  },
  {
    id: "c3",
    fullName: "Jasur Toshmatov",
    email: "jasur.t@example.com",
    initials: "JT",
    orderCount: 7,
    totalSpentCents: 1284300,
    createdAt: daysAgo(430),
  },
  {
    id: "c4",
    fullName: "Elena Sokolova",
    email: "e.sokolova@example.com",
    initials: "ES",
    orderCount: 1,
    totalSpentCents: 89900,
    createdAt: daysAgo(28),
  },
  {
    id: "c5",
    fullName: "Shohruh Umarov",
    email: "shohruh.u@example.com",
    initials: "SU",
    orderCount: 3,
    totalSpentCents: 903700,
    createdAt: daysAgo(150),
  },
];

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------

const LOW_STOCK_DEFAULT = 5;

export const inventoryRecords: InventoryRecord[] = adminProducts.map(
  (product) => ({
    productId: product.id,
    productName: product.name.en,
    sku: product.sku,
    brand: product.brand,
    quantityOnHand: product.stock,
    // Declared in the schema, written by nothing until checkout lands (D-10).
    quantityReserved: 0,
    lowStockThreshold: LOW_STOCK_DEFAULT,
  }),
);

export const inventoryMovements: InventoryMovement[] = [
  {
    id: "m1",
    productId: adminProducts[0]?.id ?? "",
    productName: "NVIDIA GeForce RTX 4090 Founders Edition",
    sku: "GPU-RTX4090-FE",
    reason: "purchase",
    quantityDelta: 10,
    quantityAfter: 12,
    note: "Supplier delivery, PO-4471",
    createdBy: "Nigora Abdullayeva",
    createdAt: daysAgo(2, 3),
  },
  {
    id: "m2",
    productId: adminProducts[3]?.id ?? "",
    productName: "Lenovo ThinkPad X1 Carbon Gen 12",
    sku: "LAP-LEN-X1C-G12",
    reason: "sale",
    quantityDelta: -2,
    quantityAfter: 3,
    note: null,
    createdBy: "System",
    createdAt: daysAgo(2, 8),
  },
  {
    id: "m3",
    productId: adminProducts[8]?.id ?? "",
    productName: "Razer DeathAdder V3 Pro",
    sku: "MOU-RAZ-DAV3",
    reason: "recount",
    quantityDelta: -1,
    quantityAfter: 0,
    note: "Cycle count: one unit missing from bin B-14",
    createdBy: "Nigora Abdullayeva",
    createdAt: daysAgo(4, 1),
  },
  {
    id: "m4",
    productId: adminProducts[5]?.id ?? "",
    productName: "Corsair K70 RGB Mechanical Keyboard",
    reason: "return",
    sku: "KEY-CORS-K70",
    quantityDelta: 1,
    quantityAfter: 25,
    note: "Customer return, unopened",
    createdBy: "Kamila Tashkentova",
    createdAt: daysAgo(5, 2),
  },
  {
    id: "m5",
    productId: adminProducts[6]?.id ?? "",
    productName: "Bondo Forge RTX 4080 Gaming PC",
    sku: "PC-FORGE-4080",
    reason: "damage",
    quantityDelta: -1,
    quantityAfter: 6,
    note: "Chassis damaged in transit, written off",
    createdBy: "Nigora Abdullayeva",
    createdAt: daysAgo(7, 5),
  },
  {
    id: "m6",
    productId: adminProducts[9]?.id ?? "",
    productName: "Bondo Atlas Workstation",
    sku: "PC-ATLAS-WS",
    reason: "adjustment",
    quantityDelta: 2,
    quantityAfter: 4,
    note: "Build completed from component stock",
    createdBy: "Nigora Abdullayeva",
    createdAt: daysAgo(9),
  },
];

// -----------------------------------------------------------------------------
// Storefront content
// -----------------------------------------------------------------------------

export const banners: Banner[] = [
  {
    id: "b1",
    title: {
      uz: "Komplektuvchilar foyda uchun emas, sifati uchun tanlanadi",
      ru: "Комплектующие выбраны по делу, а не по марже",
      en: "Components chosen on merit, not margin",
    },
    subtitle: {
      uz: "Har bir tizim 24 soat sinovdan o'tadi.",
      ru: "Каждая система проходит 24 часа тестов.",
      en: "Every system runs 24 hours of testing.",
    },
    ctaLabel: {
      uz: "Katalogni ko'rish",
      ru: "Перейти в каталог",
      en: "Browse the catalog",
    },
    ctaHref: "/products",
    isVisible: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "b2",
    title: {
      uz: "Maktabga tayyorgarlik: noutbuklarga chegirma",
      ru: "К учебному году: скидки на ноутбуки",
      en: "Back to school: laptops on offer",
    },
    subtitle: {
      uz: "Tanlangan modellarga 15% gacha.",
      ru: "До 15% на отдельные модели.",
      en: "Up to 15% on selected models.",
    },
    ctaLabel: {
      uz: "Noutbuklarni ko'rish",
      ru: "Смотреть ноутбуки",
      en: "Shop laptops",
    },
    ctaHref: "/products?category=laptops",
    isVisible: false,
    startsAt: daysAhead(3),
    endsAt: daysAhead(35),
  },
];

export const homepageSections: HomepageSection[] = [
  {
    id: "s1",
    type: "hero",
    title: { uz: "Bosh banner", ru: "Главный баннер", en: "Hero banner" },
    subtitle: {
      uz: "Sahifaning yuqori qismi",
      ru: "Верхняя часть страницы",
      en: "Top of the page",
    },
    ref: "b1",
    position: 0,
    isVisible: true,
  },
  {
    id: "s2",
    type: "featured",
    title: {
      uz: "Shu oyning tanlovi",
      ru: "Выбор месяца",
      en: "Featured this month",
    },
    subtitle: {
      uz: "Tanlangan mahsulotlar",
      ru: "Отобранные товары",
      en: "Hand-picked products",
    },
    ref: null,
    position: 1,
    isVisible: true,
  },
  {
    id: "s3",
    type: "brands",
    title: { uz: "Brendlar", ru: "Бренды", en: "Brands" },
    subtitle: {
      uz: "Biz sotadigan brendlar",
      ru: "Бренды в наличии",
      en: "Brands we stock",
    },
    ref: null,
    position: 2,
    isVisible: true,
  },
  {
    id: "s4",
    type: "category-rail",
    title: { uz: "O'yin kompyuterlari", ru: "Игровые ПК", en: "Gaming PCs" },
    subtitle: {
      uz: "Kategoriya bo'limi",
      ru: "Раздел категории",
      en: "Category rail",
    },
    ref: "gaming-pcs",
    position: 3,
    isVisible: true,
  },
  {
    id: "s5",
    type: "category-rail",
    title: { uz: "Noutbuklar", ru: "Ноутбуки", en: "Laptops" },
    subtitle: {
      uz: "Kategoriya bo'limi",
      ru: "Раздел категории",
      en: "Category rail",
    },
    ref: "laptops",
    position: 4,
    isVisible: true,
  },
  {
    id: "s6",
    type: "deals",
    title: { uz: "Bugungi chegirmalar", ru: "Акции дня", en: "Today's deals" },
    subtitle: {
      uz: "Amaldagi aksiyalar",
      ru: "Действующие акции",
      en: "Current promotions",
    },
    ref: null,
    position: 5,
    isVisible: true,
  },
  {
    id: "s7",
    type: "value-props",
    title: {
      uz: "Nega Bondo'dan xarid qilish kerak",
      ru: "Почему стоит покупать в Bondo",
      en: "Why buy from Bondo",
    },
    subtitle: { uz: "To'rt sabab", ru: "Четыре причины", en: "Four reasons" },
    ref: null,
    position: 6,
    isVisible: true,
  },
  {
    id: "s8",
    type: "reviews",
    title: {
      uz: "Mijozlar nima deydi",
      ru: "Что говорят покупатели",
      en: "What customers say",
    },
    subtitle: { uz: "Sharhlar", ru: "Отзывы", en: "Reviews" },
    ref: null,
    position: 7,
    isVisible: true,
  },
  {
    id: "s9",
    type: "newsletter",
    title: { uz: "Obuna", ru: "Подписка", en: "Newsletter" },
    subtitle: {
      uz: "Sahifaning quyi qismi",
      ru: "Нижняя часть страницы",
      en: "Bottom of the page",
    },
    ref: null,
    position: 8,
    isVisible: true,
  },
];

const EMPTY_SEO = {
  metaTitle: { uz: "", ru: "", en: "" },
  metaDescription: { uz: "", ru: "", en: "" },
  keywords: [] as string[],
};

/**
 * The static pages the footer already lists.
 *
 * These are exactly the ones `SiteFooter` renders as plain text rather than
 * links, because the pages do not exist. They are drafts here for the same
 * reason: the admin can write them, and the storefront starts linking to them
 * when they are published and the routes exist.
 */
export const contentPages: ContentPage[] = [
  {
    slug: "about",
    title: { uz: "Bondo haqida", ru: "О компании Bondo", en: "About Bondo" },
    excerpt: {
      uz: "Biz kim ekanligimiz va nima uchun shu ishni qilamiz.",
      ru: "Кто мы и почему занимаемся этим.",
      en: "Who we are and why we do this.",
    },
    body: {
      uz: "Bondo — Toshkentda joylashgan kompyuter do'koni. Biz sotadigan har bir tizimni o'zimiz yig'amiz va jo'natishdan oldin sinovdan o'tkazamiz.",
      ru: "Bondo — магазин компьютерной техники в Ташкенте. Каждую систему мы собираем сами и тестируем перед отправкой.",
      en: "Bondo is a computer store based in Tashkent. We build every system we sell and test it before it ships.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(12),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "contact",
    title: { uz: "Aloqa", ru: "Контакты", en: "Contact" },
    excerpt: {
      uz: "Biz bilan qanday bog'lanish mumkin.",
      ru: "Как с нами связаться.",
      en: "How to reach us.",
    },
    body: {
      uz: "Yordam xizmati dushanbadan shanbagacha 09:00 dan 19:00 gacha ishlaydi.",
      ru: "Поддержка работает с понедельника по субботу, с 09:00 до 19:00.",
      en: "Support is open Monday to Saturday, 09:00 to 19:00.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(12),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "warranty",
    title: { uz: "Kafolat", ru: "Гарантия", en: "Warranty" },
    excerpt: {
      uz: "Kafolat shartlari va murojaat qilish tartibi.",
      ru: "Условия гарантии и порядок обращения.",
      en: "Warranty terms and how to claim.",
    },
    body: {
      uz: "O'zimiz yig'gan har bir tizimga uch yillik kafolat beriladi. Komplektuvchilarga ishlab chiqaruvchi kafolati amal qiladi.",
      ru: "На каждую собранную нами систему даётся три года гарантии. На комплектующие действует гарантия производителя.",
      en: "Every system we build carries a three-year warranty. Components carry the manufacturer's warranty.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(20),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "delivery",
    title: {
      uz: "Yetkazib berish",
      ru: "Доставка",
      en: "Delivery information",
    },
    excerpt: {
      uz: "Muddatlar, narxlar va qamrov.",
      ru: "Сроки, стоимость и зона доставки.",
      en: "Times, prices and coverage.",
    },
    body: {
      uz: "Toshkent bo'ylab yetkazib berish bir ish kuni ichida amalga oshiriladi. Viloyatlarga uch kungacha.",
      ru: "По Ташкенту доставка в течение одного рабочего дня. В регионы — до трёх дней.",
      en: "Delivery within Tashkent takes one working day. Up to three days to the regions.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(20),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "returns",
    title: { uz: "Qaytarish", ru: "Возврат", en: "Returns" },
    excerpt: {
      uz: "O'ttiz kunlik qaytarish siyosati.",
      ru: "Политика возврата в течение тридцати дней.",
      en: "The thirty-day returns policy.",
    },
    body: {
      uz: "Ochilmagan mahsulotni o'ttiz kun ichida qaytarish mumkin. Pul to'liq qaytariladi.",
      ru: "Нераспакованный товар можно вернуть в течение тридцати дней с полным возвратом средств.",
      en: "An unopened product can be returned within thirty days for a full refund.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(31),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "faq",
    title: {
      uz: "Ko'p so'raladigan savollar",
      ru: "Частые вопросы",
      en: "Frequently asked questions",
    },
    excerpt: {
      uz: "Eng ko'p beriladigan savollarga javoblar.",
      ru: "Ответы на самые частые вопросы.",
      en: "Answers to the questions we get most.",
    },
    body: {
      uz: "Bu yerda yetkazib berish, kafolat va to'lov bo'yicha savollarga javoblar keltirilgan.",
      ru: "Здесь собраны ответы по доставке, гарантии и оплате.",
      en: "Answers about delivery, warranty and payment are collected here.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(45),
    updatedBy: "Timur Rashidov",
  },
  {
    slug: "privacy",
    title: {
      uz: "Maxfiylik siyosati",
      ru: "Политика конфиденциальности",
      en: "Privacy policy",
    },
    excerpt: {
      uz: "Qanday ma'lumot yig'amiz va nima uchun.",
      ru: "Какие данные мы собираем и зачем.",
      en: "What we collect and why.",
    },
    body: {
      uz: "Biz faqat buyurtmani bajarish uchun zarur ma'lumotlarni yig'amiz.",
      ru: "Мы собираем только те данные, которые нужны для выполнения заказа.",
      en: "We collect only the data needed to fulfil an order.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(60),
    updatedBy: "Dilnoza Karimova",
  },
  {
    slug: "terms",
    title: {
      uz: "Foydalanish shartlari",
      ru: "Условия использования",
      en: "Terms of service",
    },
    excerpt: {
      uz: "Do'kondan foydalanish shartlari.",
      ru: "Условия пользования магазином.",
      en: "The terms for using the store.",
    },
    body: {
      uz: "Saytdan foydalangan holda siz ushbu shartlarga rozilik bildirasiz.",
      ru: "Пользуясь сайтом, вы соглашаетесь с этими условиями.",
      en: "By using the site you agree to these terms.",
    },
    seo: EMPTY_SEO,
    isPublished: false,
    updatedAt: daysAgo(60),
    updatedBy: "Dilnoza Karimova",
  },
];

export function getContentPage(slug: string): ContentPage | undefined {
  return contentPages.find((page) => page.slug === slug);
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

export const storeSettings: StoreSettings = {
  store: {
    name: "Bondo",
    tagline: {
      uz: "Kompyuterlar, komplektuvchilar va aksessuarlar.",
      ru: "Компьютеры, комплектующие и аксессуары.",
      en: "Computers, components and accessories.",
    },
    supportEmail: "support@bondo.uz",
    supportPhone: "+998 71 200 30 40",
    addressLine: {
      uz: "Toshkent, Amir Temur ko'chasi 108",
      ru: "Ташкент, улица Амира Темура 108",
      en: "108 Amir Temur Street, Tashkent",
    },
  },
  commerce: {
    currency: "USD",
    taxRatePercent: 12,
    taxInclusivePricing: true,
    freeDeliveryThresholdCents: 15000,
    flatDeliveryFeeCents: 2500,
  },
  email: {
    senderName: "Bondo",
    senderAddress: "no-reply@bondo.uz",
    lowStockAlerts: true,
    orderNotifications: true,
  },
  social: {
    x: "https://x.com/bondo",
    youtube: "https://youtube.com/@bondo",
    linkedin: "https://linkedin.com/company/bondo",
    github: "https://github.com/bondo",
  },
  branding: { logoPath: null, faviconPath: null },
  businessHours: [
    { day: 1, opens: "09:00", closes: "19:00" },
    { day: 2, opens: "09:00", closes: "19:00" },
    { day: 3, opens: "09:00", closes: "19:00" },
    { day: 4, opens: "09:00", closes: "19:00" },
    { day: 5, opens: "09:00", closes: "19:00" },
    { day: 6, opens: "10:00", closes: "17:00" },
    { day: 7, opens: null, closes: null },
  ],
};

// -----------------------------------------------------------------------------
// Audit, activity and notifications
// -----------------------------------------------------------------------------

export const auditEntries: AuditEntry[] = [
  {
    id: "au1",
    action: "update",
    entityType: "product",
    entityLabel: "ASUS ProArt Display PA279CRV",
    actorName: "Sardor Yusupov",
    actorInitials: "SY",
    summary: {
      uz: "Chop etish sanasi belgilandi",
      ru: "Назначена дата публикации",
      en: "Publishing date scheduled",
    },
    createdAt: daysAgo(0, 2),
  },
  {
    id: "au2",
    action: "adjust",
    entityType: "inventory",
    entityLabel: "GPU-RTX4090-FE",
    actorName: "Nigora Abdullayeva",
    actorInitials: "NA",
    summary: {
      uz: "Ombor to'ldirildi: +10",
      ru: "Пополнение склада: +10",
      en: "Stock received: +10",
    },
    createdAt: daysAgo(2, 3),
  },
  {
    id: "au3",
    action: "update",
    entityType: "settings",
    entityLabel: "commerce.taxRatePercent",
    actorName: "Dilnoza Karimova",
    actorInitials: "DK",
    summary: {
      uz: "Soliq stavkasi 12% ga o'zgartirildi",
      ru: "Налоговая ставка изменена на 12%",
      en: "Tax rate changed to 12%",
    },
    createdAt: daysAgo(3, 6),
  },
  {
    id: "au4",
    action: "create",
    entityType: "product",
    entityLabel: "Corsair K70 RGB Mechanical Keyboard",
    actorName: "Sardor Yusupov",
    actorInitials: "SY",
    summary: {
      uz: "Yangi mahsulot yaratildi",
      ru: "Создан новый товар",
      en: "New product created",
    },
    createdAt: daysAgo(5, 1),
  },
  {
    id: "au5",
    action: "delete",
    entityType: "banner",
    entityLabel: "Summer sale 2026",
    actorName: "Timur Rashidov",
    actorInitials: "TR",
    summary: {
      uz: "Muddati o'tgan banner o'chirildi",
      ru: "Удалён просроченный баннер",
      en: "Expired banner removed",
    },
    createdAt: daysAgo(8),
  },
  {
    id: "au6",
    action: "login",
    entityType: "admin",
    entityLabel: "kamila@bondo.uz",
    actorName: "Kamila Tashkentova",
    actorInitials: "KT",
    summary: {
      uz: "Tizimga kirdi",
      ru: "Вход в систему",
      en: "Signed in",
    },
    createdAt: daysAgo(0, 7),
  },
];

export const adminNotifications: AdminNotification[] = [
  {
    id: "n1",
    kind: "low-stock",
    title: {
      uz: "Uchta mahsulot tugayapti",
      ru: "Три товара заканчиваются",
      en: "Three products are running low",
    },
    body: {
      uz: "ThinkPad X1 Carbon, Atlas Workstation va Forge 4080.",
      ru: "ThinkPad X1 Carbon, Atlas Workstation и Forge 4080.",
      en: "ThinkPad X1 Carbon, Atlas Workstation and Forge 4080.",
    },
    href: "/admin/inventory",
    createdAt: daysAgo(0, 1),
    isRead: false,
  },
  {
    id: "n2",
    kind: "order",
    title: {
      uz: "Yangi buyurtma BND-2841",
      ru: "Новый заказ BND-2841",
      en: "New order BND-2841",
    },
    body: {
      uz: "To'lov qabul qilindi, yig'ishni kutmoqda.",
      ru: "Оплата получена, ожидает сборки.",
      en: "Payment received, awaiting fulfilment.",
    },
    href: null,
    createdAt: daysAgo(0, 2),
    isRead: false,
  },
  {
    id: "n3",
    kind: "system",
    title: {
      uz: "Chop etish rejalashtirilgan",
      ru: "Запланирована публикация",
      en: "Publishing scheduled",
    },
    body: {
      uz: "ASUS ProArt olti kundan keyin chop etiladi.",
      ru: "ASUS ProArt будет опубликован через шесть дней.",
      en: "ASUS ProArt goes live in six days.",
    },
    href: "/admin/products",
    createdAt: daysAgo(0, 3),
    isRead: true,
  },
];

// -----------------------------------------------------------------------------
// Dashboard series
// -----------------------------------------------------------------------------

/**
 * Thirty days of revenue, in minor units.
 *
 * Deterministic rather than random: a chart that redraws differently on every
 * render makes a visual regression impossible to spot, and a random series on
 * the server disagrees with the client's. The shape is a mild upward trend with
 * a weekend dip, which is what retail actually looks like.
 */
export const revenueSeries: SeriesPoint[] = Array.from(
  { length: 30 },
  (_, index) => {
    const date = new Date(EPOCH - (29 - index) * 86_400_000);
    const weekday = date.getUTCDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.72 : 1;
    const trend = 1 + index * 0.018;
    // A fixed wobble so the line is not a straight ramp.
    const wobble = 1 + Math.sin(index * 1.7) * 0.14;

    return {
      date: date.toISOString().slice(0, 10),
      value: Math.round(184000 * trend * weekendDip * wobble),
    };
  },
);

export const ordersSeries: SeriesPoint[] = revenueSeries.map((point) => ({
  date: point.date,
  value: Math.max(1, Math.round(point.value / 62000)),
}));
