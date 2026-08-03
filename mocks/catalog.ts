import type {
  Brand,
  Category,
  Product,
  ProductSummary,
  Review,
} from "@/types/catalog";

/**
 * TEMPORARY interface data — see `mocks/README.md` and ADR-36.
 *
 * Deleted when `services/products.service.ts` lands. Nothing outside `app/` and
 * `components/` may import this file, so removing the folder surfaces every
 * call site as a compile error rather than a silent gap.
 *
 * Prices are integer minor units (ADR-2). Specifications are real published
 * figures for these parts, so the layout is exercised with the string lengths
 * it will actually receive.
 */

export const categories: Category[] = [
  {
    slug: "gaming-pcs",
    name: "Gaming PCs",
    description: "Prebuilt systems tuned for high frame rates at 1440p and 4K.",
    productCount: 3,
  },
  {
    slug: "laptops",
    name: "Laptops",
    description: "Portable workstations and gaming notebooks.",
    productCount: 3,
  },
  {
    slug: "components",
    name: "Components",
    description: "Graphics cards, processors, memory and storage.",
    productCount: 4,
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Keyboards, mice, monitors and audio.",
    productCount: 3,
  },
];

export const brands: Brand[] = [
  { slug: "nvidia", name: "NVIDIA", monogram: "NV", productCount: 2 },
  { slug: "amd", name: "AMD", monogram: "AMD", productCount: 2 },
  { slug: "intel", name: "Intel", monogram: "IN", productCount: 1 },
  { slug: "corsair", name: "Corsair", monogram: "CR", productCount: 3 },
  { slug: "lenovo", name: "Lenovo", monogram: "LN", productCount: 2 },
  { slug: "asus", name: "ASUS", monogram: "AS", productCount: 2 },
  { slug: "razer", name: "Razer", monogram: "RZ", productCount: 1 },
];

export const products: Product[] = [
  {
    id: "c0000000-0000-4000-8000-000000000001",
    slug: "nvidia-geforce-rtx-4090-founders-edition",
    sku: "GPU-RTX4090-FE",
    name: "NVIDIA GeForce RTX 4090 Founders Edition",
    brand: "NVIDIA",
    category: "components",
    image: "products/gpu-rtx4090-fe.webp",
    imageAlt: "NVIDIA GeForce RTX 4090 Founders Edition graphics card",
    priceCents: 159900,
    salePriceCents: 149900,
    rating: 4.8,
    reviewCount: 214,
    stock: 12,
    badges: ["bestseller"],
    shortDescription: "Flagship graphics card with 24GB of GDDR6X memory.",
    description:
      "Built for 4K gaming and GPU compute workloads. The Founders Edition cooler keeps the board quiet under sustained load, and the triple DisplayPort output drives three high-refresh panels without an adapter.",
    warrantyMonths: 36,
    specs: [
      { group: "Memory", name: "Capacity", value: "24", unit: "GB" },
      { group: "Memory", name: "Type", value: "GDDR6X", unit: null },
      { group: "Power", name: "Board power", value: "450", unit: "W" },
      {
        group: "Connectivity",
        name: "Display outputs",
        value: "3x DisplayPort 1.4a, 1x HDMI 2.1",
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000002",
    slug: "amd-ryzen-9-7950x",
    sku: "CPU-R9-7950X",
    name: "AMD Ryzen 9 7950X",
    brand: "AMD",
    category: "components",
    image: "products/cpu-ryzen-9-7950x.webp",
    imageAlt: "AMD Ryzen 9 7950X desktop processor",
    priceCents: 69900,
    salePriceCents: null,
    rating: 4.7,
    reviewCount: 168,
    stock: 40,
    badges: ["bestseller"],
    shortDescription: "16-core desktop processor on socket AM5.",
    description:
      "Sixteen Zen 4 cores boosting to 5.7GHz. Handles compilation, simulation and video encoding without throttling, and leaves enough headroom that a discrete GPU is never waiting on the processor.",
    warrantyMonths: 36,
    specs: [
      { group: "Cores", name: "Core count", value: "16", unit: null },
      { group: "Cores", name: "Thread count", value: "32", unit: null },
      { group: "Clocks", name: "Boost clock", value: "5.7", unit: "GHz" },
      { group: "Platform", name: "Socket", value: "AM5", unit: null },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000003",
    slug: "corsair-vengeance-32gb-ddr5-6000",
    sku: "MEM-CORS-32GB-DDR5",
    name: "Corsair Vengeance 32GB DDR5-6000",
    brand: "Corsair",
    category: "components",
    image: "products/mem-corsair-vengeance-ddr5.webp",
    imageAlt: "Corsair Vengeance DDR5 memory kit, two modules",
    priceCents: 14900,
    salePriceCents: 12900,
    rating: 4.6,
    reviewCount: 91,
    stock: 150,
    badges: [],
    shortDescription: "Two 16GB modules rated for 6000 MT/s.",
    description:
      "DDR5 kit with on-die ECC and a low-profile aluminium heat spreader that clears oversized air coolers. Tested against AM5 and LGA1700 memory profiles.",
    warrantyMonths: 60,
    specs: [
      { group: "Memory", name: "Capacity", value: "32", unit: "GB" },
      { group: "Memory", name: "Speed", value: "6000", unit: "MT/s" },
      { group: "Memory", name: "Latency", value: "CL36", unit: null },
      { group: "Physical", name: "Height", value: "34", unit: "mm" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000004",
    slug: "lenovo-thinkpad-x1-carbon-gen-12",
    sku: "LAP-LEN-X1C-G12",
    name: "Lenovo ThinkPad X1 Carbon Gen 12",
    brand: "Lenovo",
    category: "laptops",
    image: "products/lap-thinkpad-x1-carbon.webp",
    imageAlt: "Lenovo ThinkPad X1 Carbon laptop, open",
    priceCents: 189900,
    salePriceCents: null,
    rating: 4.5,
    reviewCount: 132,
    stock: 3,
    badges: ["low-stock"],
    shortDescription: "Fourteen-inch business ultrabook at 1.09kg.",
    description:
      "Carbon-fibre chassis, a keyboard that survives a full working day, and enough battery to leave the charger behind. Serviceable memory and storage, which is rarer in this class than it should be.",
    warrantyMonths: 36,
    specs: [
      { group: "Display", name: "Size", value: "14", unit: "in" },
      {
        group: "Display",
        name: "Resolution",
        value: "2880 x 1800",
        unit: null,
      },
      { group: "Physical", name: "Weight", value: "1.09", unit: "kg" },
      { group: "Battery", name: "Capacity", value: "57", unit: "Wh" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000005",
    slug: "amd-radeon-rx-7900-xtx",
    sku: "GPU-RX7900XTX",
    name: "AMD Radeon RX 7900 XTX",
    brand: "AMD",
    category: "components",
    image: "products/gpu-rx-7900-xtx.webp",
    imageAlt: "AMD Radeon RX 7900 XTX graphics card",
    priceCents: 99900,
    salePriceCents: 89900,
    rating: 4.4,
    reviewCount: 76,
    stock: 8,
    badges: [],
    shortDescription: "High-end graphics card with 24GB of GDDR6.",
    description:
      "Twenty-four gigabytes of memory at a price the competition does not match, which matters more for high-resolution texture work than for frame rates alone.",
    warrantyMonths: 24,
    specs: [
      { group: "Memory", name: "Capacity", value: "24", unit: "GB" },
      { group: "Memory", name: "Type", value: "GDDR6", unit: null },
      { group: "Power", name: "Board power", value: "355", unit: "W" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000006",
    slug: "corsair-k70-rgb-mechanical-keyboard",
    sku: "KEY-CORS-K70",
    name: "Corsair K70 RGB Mechanical Keyboard",
    brand: "Corsair",
    category: "accessories",
    image: "products/key-corsair-k70.webp",
    imageAlt: "Corsair K70 RGB mechanical keyboard",
    priceCents: 16900,
    salePriceCents: null,
    rating: 4.6,
    reviewCount: 340,
    stock: 25,
    badges: ["new"],
    shortDescription: "Mechanical keyboard with an aluminium top plate.",
    description:
      "Linear switches rated to 100 million actuations on a brushed aluminium frame that does not flex. Per-key lighting is configurable on-device, so it survives a machine rebuild.",
    warrantyMonths: 24,
    specs: [
      {
        group: "Switches",
        name: "Type",
        value: "Linear mechanical",
        unit: null,
      },
      { group: "Switches", name: "Actuation", value: "1.2", unit: "mm" },
      {
        group: "Build",
        name: "Top plate",
        value: "Brushed aluminium",
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000007",
    slug: "bondo-forge-rtx-4080-gaming-pc",
    sku: "PC-FORGE-4080",
    name: "Bondo Forge RTX 4080 Gaming PC",
    brand: "Bondo",
    category: "gaming-pcs",
    image: "products/pc-forge-4080.webp",
    imageAlt: "Bondo Forge gaming desktop in a tempered glass case",
    priceCents: 249900,
    salePriceCents: 229900,
    rating: 4.9,
    reviewCount: 58,
    stock: 6,
    badges: ["bestseller"],
    shortDescription: "Ryzen 7 and RTX 4080 Super, built and tested in-house.",
    description:
      "Assembled, cable-managed and burned in for 24 hours before it ships. Every unit leaves with its thermal and stability test results attached, so you know what this specific machine did rather than what the model is supposed to do.",
    warrantyMonths: 36,
    specs: [
      {
        group: "Processor",
        name: "Model",
        value: "AMD Ryzen 7 7800X3D",
        unit: null,
      },
      {
        group: "Graphics",
        name: "Model",
        value: "NVIDIA RTX 4080 Super",
        unit: null,
      },
      { group: "Memory", name: "Capacity", value: "32", unit: "GB" },
      { group: "Storage", name: "Capacity", value: "2", unit: "TB" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000008",
    slug: "asus-rog-strix-g16-gaming-laptop",
    sku: "LAP-ASUS-G16",
    name: "ASUS ROG Strix G16 Gaming Laptop",
    brand: "ASUS",
    category: "laptops",
    image: "products/lap-asus-rog-g16.webp",
    imageAlt: "ASUS ROG Strix G16 gaming laptop",
    priceCents: 199900,
    salePriceCents: 179900,
    rating: 4.5,
    reviewCount: 87,
    stock: 14,
    badges: [],
    shortDescription: "Sixteen-inch 240Hz gaming laptop with RTX 4070.",
    description:
      "A 240Hz panel with enough GPU behind it to actually use the refresh rate at native resolution, and a cooling design that keeps the chassis usable while it does.",
    warrantyMonths: 24,
    specs: [
      { group: "Display", name: "Size", value: "16", unit: "in" },
      { group: "Display", name: "Refresh rate", value: "240", unit: "Hz" },
      {
        group: "Graphics",
        name: "Model",
        value: "NVIDIA RTX 4070 Laptop",
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000009",
    slug: "razer-deathadder-v3-pro",
    sku: "MOU-RAZ-DAV3",
    name: "Razer DeathAdder V3 Pro",
    brand: "Razer",
    category: "accessories",
    image: "products/mou-razer-deathadder-v3.webp",
    imageAlt: "Razer DeathAdder V3 Pro wireless mouse",
    priceCents: 14900,
    salePriceCents: null,
    rating: 4.7,
    reviewCount: 412,
    stock: 0,
    badges: [],
    shortDescription: "Wireless esports mouse at 63 grams.",
    description:
      "Sixty-three grams without drilling holes in the shell, and a battery that lasts a working week between charges.",
    warrantyMonths: 24,
    specs: [
      { group: "Sensor", name: "Resolution", value: "30000", unit: "DPI" },
      { group: "Physical", name: "Weight", value: "63", unit: "g" },
      { group: "Battery", name: "Life", value: "90", unit: "hours" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000010",
    slug: "bondo-atlas-workstation",
    sku: "PC-ATLAS-WS",
    name: "Bondo Atlas Workstation",
    brand: "Bondo",
    category: "gaming-pcs",
    image: "products/pc-atlas-workstation.webp",
    imageAlt: "Bondo Atlas workstation tower",
    priceCents: 399900,
    salePriceCents: null,
    rating: 4.8,
    reviewCount: 22,
    stock: 4,
    badges: ["low-stock"],
    shortDescription: "Threadripper workstation for simulation and rendering.",
    description:
      "Built for work that runs for hours rather than seconds. ECC memory throughout and a cooling design rated for sustained all-core load, not burst benchmarks.",
    warrantyMonths: 36,
    specs: [
      {
        group: "Processor",
        name: "Model",
        value: "AMD Threadripper 7970X",
        unit: null,
      },
      { group: "Memory", name: "Capacity", value: "128", unit: "GB ECC" },
      { group: "Storage", name: "Capacity", value: "4", unit: "TB" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000011",
    slug: "asus-proart-display-pa279crv",
    sku: "MON-ASUS-PA279",
    name: "ASUS ProArt Display PA279CRV",
    brand: "ASUS",
    category: "accessories",
    image: "products/mon-asus-proart.webp",
    imageAlt: "ASUS ProArt 27-inch monitor",
    priceCents: 49900,
    salePriceCents: 42900,
    rating: 4.6,
    reviewCount: 118,
    stock: 19,
    badges: [],
    shortDescription: "Twenty-seven-inch 4K monitor, colour calibrated.",
    description:
      "Ships with a per-unit calibration report and covers 99% of Adobe RGB. USB-C carries display, data and 96W of power on one cable.",
    warrantyMonths: 36,
    specs: [
      { group: "Display", name: "Size", value: "27", unit: "in" },
      {
        group: "Display",
        name: "Resolution",
        value: "3840 x 2160",
        unit: null,
      },
      { group: "Colour", name: "Adobe RGB", value: "99", unit: "%" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000012",
    slug: "intel-core-i9-14900k",
    sku: "CPU-I9-14900K",
    name: "Intel Core i9-14900K",
    brand: "Intel",
    category: "components",
    image: "products/cpu-intel-i9-14900k.webp",
    imageAlt: "Intel Core i9-14900K desktop processor",
    priceCents: 58900,
    salePriceCents: 52900,
    rating: 4.3,
    reviewCount: 143,
    stock: 31,
    badges: [],
    shortDescription: "24-core desktop processor on socket LGA1700.",
    description:
      "Eight performance cores and sixteen efficiency cores, with the single-threaded lead that still decides frame rates in older engines.",
    warrantyMonths: 36,
    specs: [
      { group: "Cores", name: "Core count", value: "24", unit: null },
      { group: "Clocks", name: "Boost clock", value: "6.0", unit: "GHz" },
      { group: "Platform", name: "Socket", value: "LGA1700", unit: null },
    ],
  },
];

export const reviews: Review[] = [
  {
    id: "r1",
    author: "Marcus Reid",
    initials: "MR",
    rating: 5,
    title: "Arrived tested, not just assembled",
    body: "The burn-in report in the box listed the actual thermals for my unit. First builder I have used that shows its working.",
    productName: "Bondo Forge RTX 4080 Gaming PC",
    verified: true,
  },
  {
    id: "r2",
    author: "Priya Nandakumar",
    initials: "PN",
    rating: 5,
    title: "Correct part, sensible packaging",
    body: "Ordered on a Tuesday, installed on a Thursday. The card was double-boxed with the connector supported, which is not a given.",
    productName: "NVIDIA GeForce RTX 4090 Founders Edition",
    verified: true,
  },
  {
    id: "r3",
    author: "Tom Ashworth",
    initials: "TA",
    rating: 4,
    title: "Support answered a compatibility question properly",
    body: "Asked whether the kit would clear my cooler. Got the actual height back rather than a link to the product page.",
    productName: "Corsair Vengeance 32GB DDR5-6000",
    verified: true,
  },
];

/** Products a shopper can currently buy, in the order the storefront shows them. */
export const featuredProducts: ProductSummary[] = products.filter((p) =>
  p.badges.includes("bestseller"),
);

export const dealProducts: ProductSummary[] = products.filter(
  (p) => p.salePriceCents !== null,
);

export function getProductsByCategory(slug: string): ProductSummary[] {
  return products.filter((p) => p.category === slug);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}
