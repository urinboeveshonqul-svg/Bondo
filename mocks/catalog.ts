import type {
  Brand,
  LocalizedText,
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
 * it will actually receive — which now includes Cyrillic, where the same
 * sentence typically runs 10–15% longer than in English and is what will break a
 * fixed-width control first.
 *
 * **Copy is localized on the record** (ADR-39), not in `messages/`: product
 * descriptions are per-row content written by merchandisers, and in Phase 3B
 * they come from the database rather than from a message file. Specification
 * `group` and `name` are the exception — they are translation keys into the
 * `product` namespace, because they are a small controlled vocabulary reused
 * across the whole catalog.
 */

export const categories: Category[] = [
  {
    slug: "gaming-pcs",
    name: {
      uz: "O'yin kompyuterlari",
      ru: "Игровые ПК",
      en: "Gaming PCs",
    },
    description: {
      uz: "1440p va 4K o'yinlar uchun yig'ilgan tayyor kompyuterlar.",
      ru: "Готовые компьютеры для игр в 1440p и 4K.",
      en: "Prebuilt computers for gaming at 1440p and 4K.",
    },
    productCount: 3,
  },
  {
    slug: "laptops",
    name: {
      uz: "Noutbuklar",
      ru: "Ноутбуки",
      en: "Laptops",
    },
    description: {
      uz: "Ish uchun va o'yin uchun noutbuklar.",
      ru: "Ноутбуки для работы и для игр.",
      en: "Laptops for work and for gaming.",
    },
    productCount: 3,
  },
  {
    slug: "components",
    name: {
      uz: "Butlovchi qismlar",
      ru: "Комплектующие",
      en: "PC parts",
    },
    description: {
      uz: "Videokartalar, protsessorlar, xotira va disklar.",
      ru: "Видеокарты, процессоры, память и накопители.",
      en: "Graphics cards, processors, memory and storage.",
    },
    productCount: 4,
  },
  {
    slug: "accessories",
    name: {
      uz: "Aksessuarlar",
      ru: "Аксессуары",
      en: "Accessories",
    },
    description: {
      uz: "Klaviatura, sichqoncha, monitor va quloqchinlar.",
      ru: "Клавиатуры, мыши, мониторы и наушники.",
      en: "Keyboards, mice, monitors and headsets.",
    },
    productCount: 3,
  },
];

/** Brand names are trademarks and are not translated or transliterated. */
export const brands: Brand[] = [
  { slug: "nvidia", name: "NVIDIA", monogram: "NV", productCount: 2 },
  { slug: "amd", name: "AMD", monogram: "AMD", productCount: 2 },
  { slug: "intel", name: "Intel", monogram: "IN", productCount: 1 },
  { slug: "corsair", name: "Corsair", monogram: "CR", productCount: 3 },
  { slug: "lenovo", name: "Lenovo", monogram: "LN", productCount: 2 },
  { slug: "asus", name: "ASUS", monogram: "AS", productCount: 2 },
  { slug: "razer", name: "Razer", monogram: "RZ", productCount: 1 },
];

/**
 * A model name that is the same string in every language.
 *
 * Manufacturer model numbers are trademarks: "GeForce RTX 4090" is not
 * translated, and writing it out three times per product would be noise that
 * invites one copy to drift. Bondo's own builds are written out per locale
 * below, because there the words around the model really do differ.
 */
function modelName(name: string): LocalizedText {
  return { uz: name, ru: name, en: name };
}

export const products: Product[] = [
  {
    id: "c0000000-0000-4000-8000-000000000001",
    slug: "nvidia-geforce-rtx-4090-founders-edition",
    sku: "GPU-RTX4090-FE",
    name: modelName("NVIDIA GeForce RTX 4090 Founders Edition"),
    brand: "NVIDIA",
    category: "components",
    image: "products/gpu-rtx4090-fe.webp",
    imageAlt: {
      uz: "NVIDIA GeForce RTX 4090 Founders Edition videokartasi",
      ru: "Видеокарта NVIDIA GeForce RTX 4090 Founders Edition",
      en: "NVIDIA GeForce RTX 4090 Founders Edition graphics card",
    },
    priceCents: 159900,
    salePriceCents: 149900,
    rating: 4.8,
    reviewCount: 214,
    stock: 12,
    badges: ["bestseller"],
    shortDescription: {
      uz: "24 GB GDDR6X xotirali eng kuchli videokarta.",
      ru: "Флагманская видеокарта с 24 ГБ памяти GDDR6X.",
      en: "Flagship graphics card with 24GB of GDDR6X memory.",
    },
    description: {
      uz: "4K o'yinlar va og'ir grafik ishlar uchun. Founders Edition sovutgichi uzoq yuklamada ham jim ishlaydi. Uchta DisplayPort chiqishi adaptersiz uchta monitorni ko'taradi.",
      ru: "Создана для игр в 4K и вычислительных задач на GPU. Кулер Founders Edition остаётся тихим при длительной нагрузке, а три выхода DisplayPort позволяют подключить три монитора с высокой частотой обновления без переходников.",
      en: "Built for 4K gaming and GPU compute workloads. The Founders Edition cooler keeps the board quiet under sustained load, and the triple DisplayPort output drives three high-refresh panels without an adapter.",
    },
    warrantyMonths: 36,
    specs: [
      { group: "memory", name: "capacity", value: "24", unit: "GB" },
      { group: "memory", name: "type", value: "GDDR6X", unit: null },
      { group: "power", name: "boardPower", value: "450", unit: "W" },
      {
        group: "connectivity",
        name: "displayOutputs",
        value: "3x DisplayPort 1.4a, 1x HDMI 2.1",
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000002",
    slug: "amd-ryzen-9-7950x",
    sku: "CPU-R9-7950X",
    name: modelName("AMD Ryzen 9 7950X"),
    brand: "AMD",
    category: "components",
    image: "products/cpu-ryzen-9-7950x.webp",
    imageAlt: {
      uz: "AMD Ryzen 9 7950X ish stoli protsessori",
      ru: "Настольный процессор AMD Ryzen 9 7950X",
      en: "AMD Ryzen 9 7950X desktop processor",
    },
    priceCents: 69900,
    salePriceCents: null,
    rating: 4.7,
    reviewCount: 168,
    stock: 40,
    badges: ["bestseller"],
    shortDescription: {
      uz: "AM5 soketidagi 16 yadroli ish stoli protsessori.",
      ru: "16-ядерный настольный процессор для сокета AM5.",
      en: "16-core desktop processor on socket AM5.",
    },
    description: {
      uz: "Zen 4 arxitekturasida 16 ta yadro, chastotasi 5,7 GHz gacha ko'tariladi. Video montaj, 3D render va dasturlash uchun quvvati yetarli. Kuchli videokarta bilan ishlaganda protsessor to'siq bo'lmaydi.",
      ru: "Шестнадцать ядер Zen 4 с ускорением до 5,7 ГГц. Справляется с компиляцией, симуляцией и кодированием видео без троттлинга и оставляет запас, при котором дискретная видеокарта не ждёт процессор.",
      en: "Sixteen Zen 4 cores boosting to 5.7GHz. Handles compilation, simulation and video encoding without throttling, and leaves enough headroom that a discrete GPU is never waiting on the processor.",
    },
    warrantyMonths: 36,
    specs: [
      { group: "cores", name: "coreCount", value: "16", unit: null },
      { group: "cores", name: "threadCount", value: "32", unit: null },
      { group: "clocks", name: "boostClock", value: "5.7", unit: "GHz" },
      { group: "platform", name: "socket", value: "AM5", unit: null },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000003",
    slug: "corsair-vengeance-32gb-ddr5-6000",
    sku: "MEM-CORS-32GB-DDR5",
    name: modelName("Corsair Vengeance 32GB DDR5-6000"),
    brand: "Corsair",
    category: "components",
    image: "products/mem-corsair-vengeance-ddr5.webp",
    imageAlt: {
      uz: "Corsair Vengeance DDR5 xotira to'plami, ikkita modul",
      ru: "Комплект памяти Corsair Vengeance DDR5, два модуля",
      en: "Corsair Vengeance DDR5 memory kit, two modules",
    },
    priceCents: 14900,
    salePriceCents: 12900,
    rating: 4.6,
    reviewCount: 91,
    stock: 150,
    badges: [],
    shortDescription: {
      uz: "6000 MT/s uchun mo'ljallangan ikkita 16 GB modul.",
      ru: "Два модуля по 16 ГБ с частотой 6000 MT/s.",
      en: "Two 16GB modules rated for 6000 MT/s.",
    },
    description: {
      uz: "Past alyuminiy radiatorli DDR5 to'plami: katta kulerga xalaqit bermaydi. AM5 va LGA1700 platalarida sinab ko'rilgan.",
      ru: "Комплект DDR5 со встроенной ECC и низкопрофильным алюминиевым радиатором, который не мешает крупным воздушным кулерам. Протестирован с профилями памяти AM5 и LGA1700.",
      en: "DDR5 kit with on-die ECC and a low-profile aluminium heat spreader that clears oversized air coolers. Tested against AM5 and LGA1700 memory profiles.",
    },
    warrantyMonths: 60,
    specs: [
      { group: "memory", name: "capacity", value: "32", unit: "GB" },
      { group: "memory", name: "speed", value: "6000", unit: "MT/s" },
      { group: "memory", name: "latency", value: "CL36", unit: null },
      { group: "physical", name: "height", value: "34", unit: "mm" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000004",
    slug: "lenovo-thinkpad-x1-carbon-gen-12",
    sku: "LAP-LEN-X1C-G12",
    name: modelName("Lenovo ThinkPad X1 Carbon Gen 12"),
    brand: "Lenovo",
    category: "laptops",
    image: "products/lap-thinkpad-x1-carbon.webp",
    imageAlt: {
      uz: "Ochiq holatdagi Lenovo ThinkPad X1 Carbon noutbuki",
      ru: "Ноутбук Lenovo ThinkPad X1 Carbon в открытом виде",
      en: "Lenovo ThinkPad X1 Carbon laptop, open",
    },
    priceCents: 189900,
    salePriceCents: null,
    rating: 4.5,
    reviewCount: 132,
    stock: 3,
    badges: ["low-stock"],
    shortDescription: {
      uz: "Og'irligi 1,09 kg bo'lgan 14 dyuymli ish noutbuki.",
      ru: "Четырнадцатидюймовый бизнес-ультрабук массой 1,09 кг.",
      en: "Fourteen-inch business ultrabook at 1.09kg.",
    },
    description: {
      uz: "Uglerod tolali korpus, kun bo'yi ishlashga qulay klaviatura va zaryadlagichni uyda qoldirsa bo'ladigan batareya. Xotira va diskni keyinchalik almashtirish mumkin.",
      ru: "Корпус из углеродного волокна, клавиатура, которая выдерживает полный рабочий день, и батарея, с которой можно оставить зарядку дома. Память и накопитель обслуживаются — в этом классе это встречается реже, чем следовало бы.",
      en: "Carbon-fibre chassis, a keyboard that survives a full working day, and enough battery to leave the charger behind. Serviceable memory and storage, which is rarer in this class than it should be.",
    },
    warrantyMonths: 36,
    specs: [
      { group: "display", name: "size", value: "14", unit: "in" },
      {
        group: "display",
        name: "resolution",
        value: "2880 x 1800",
        unit: null,
      },
      { group: "physical", name: "weight", value: "1.09", unit: "kg" },
      { group: "battery", name: "capacity", value: "57", unit: "Wh" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000005",
    slug: "amd-radeon-rx-7900-xtx",
    sku: "GPU-RX7900XTX",
    name: modelName("AMD Radeon RX 7900 XTX"),
    brand: "AMD",
    category: "components",
    image: "products/gpu-rx-7900-xtx.webp",
    imageAlt: {
      uz: "AMD Radeon RX 7900 XTX videokartasi",
      ru: "Видеокарта AMD Radeon RX 7900 XTX",
      en: "AMD Radeon RX 7900 XTX graphics card",
    },
    priceCents: 99900,
    salePriceCents: 89900,
    rating: 4.4,
    reviewCount: 76,
    stock: 8,
    badges: [],
    shortDescription: {
      uz: "24 GB GDDR6 xotirali kuchli videokarta.",
      ru: "Видеокарта высокого класса с 24 ГБ памяти GDDR6.",
      en: "High-end graphics card with 24GB of GDDR6.",
    },
    description: {
      uz: "Shu narxda 24 GB xotira. Og'ir teksturali o'yinlar va 3D dasturlar uchun ayni muddao.",
      ru: "Двадцать четыре гигабайта памяти по цене, которую конкуренты не предлагают: для работы с текстурами высокого разрешения это важнее, чем частота кадров сама по себе.",
      en: "Twenty-four gigabytes of memory at a price the competition does not match, which matters more for high-resolution texture work than for frame rates alone.",
    },
    warrantyMonths: 24,
    specs: [
      { group: "memory", name: "capacity", value: "24", unit: "GB" },
      { group: "memory", name: "type", value: "GDDR6", unit: null },
      { group: "power", name: "boardPower", value: "355", unit: "W" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000006",
    slug: "corsair-k70-rgb-mechanical-keyboard",
    sku: "KEY-CORS-K70",
    name: modelName("Corsair K70 RGB Mechanical Keyboard"),
    brand: "Corsair",
    category: "accessories",
    image: "products/key-corsair-k70.webp",
    imageAlt: {
      uz: "Corsair K70 RGB mexanik klaviaturasi",
      ru: "Механическая клавиатура Corsair K70 RGB",
      en: "Corsair K70 RGB mechanical keyboard",
    },
    priceCents: 16900,
    salePriceCents: null,
    rating: 4.6,
    reviewCount: 340,
    stock: 25,
    badges: ["new"],
    shortDescription: {
      uz: "Alyuminiy yuqori panelli mexanik klaviatura.",
      ru: "Механическая клавиатура с алюминиевой верхней панелью.",
      en: "Mechanical keyboard with an aluminium top plate.",
    },
    description: {
      uz: "100 million bosishga chidaydigan chiziqli tugmalar, egilmaydigan alyuminiy ramka. Yoritish klaviaturaning o'zida sozlanadi, Windows qayta o'rnatilsa ham saqlanib qoladi.",
      ru: "Линейные переключатели с ресурсом 100 миллионов нажатий на шлифованной алюминиевой раме, которая не прогибается. Подсветка каждой клавиши настраивается в самом устройстве, поэтому переустановка системы её не сбрасывает.",
      en: "Linear switches rated to 100 million actuations on a brushed aluminium frame that does not flex. Per-key lighting is configurable on-device, so it survives a machine rebuild.",
    },
    warrantyMonths: 24,
    specs: [
      {
        group: "switches",
        name: "type",
        // Prose, so it is localized. Contrast with "GDDR6X" two products up,
        // which is an identifier and stays a plain string.
        value: {
          uz: "Chiziqli mexanik",
          ru: "Линейные механические",
          en: "Linear mechanical",
        },
        unit: null,
      },
      { group: "switches", name: "actuation", value: "1.2", unit: "mm" },
      {
        group: "build",
        name: "topPlate",
        value: {
          uz: "Silliqlangan alyuminiy",
          ru: "Шлифованный алюминий",
          en: "Brushed aluminium",
        },
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000007",
    slug: "bondo-forge-rtx-4080-gaming-pc",
    sku: "PC-FORGE-4080",
    name: {
      uz: "Bondo Forge RTX 4080 o'yin kompyuteri",
      ru: "Игровой компьютер Bondo Forge RTX 4080",
      en: "Bondo Forge RTX 4080 Gaming PC",
    },
    brand: "Bondo",
    category: "gaming-pcs",
    image: "products/pc-forge-4080.webp",
    imageAlt: {
      uz: "Shaffof shishali korpusdagi Bondo Forge o'yin kompyuteri",
      ru: "Игровой компьютер Bondo Forge в корпусе с закалённым стеклом",
      en: "Bondo Forge gaming desktop in a tempered glass case",
    },
    priceCents: 249900,
    salePriceCents: 229900,
    rating: 4.9,
    reviewCount: 58,
    stock: 6,
    badges: ["bestseller"],
    shortDescription: {
      uz: "Ryzen 7 va RTX 4080 Super. O'zimiz yig'ib, sinovdan o'tkazganmiz.",
      ru: "Ryzen 7 и RTX 4080 Super, собрано и протестировано у нас.",
      en: "Ryzen 7 and RTX 4080 Super, built and tested in-house.",
    },
    description: {
      uz: "Yig'ilgandan keyin kabellari tartibga solinadi va 24 soat sinovdan o'tkaziladi. Harorat va barqarorlik natijalari quti ichida keladi, ya'ni aynan shu kompyuter nima ko'rsatganini bilasiz.",
      ru: "Собирается, кабели укладываются, и перед отправкой машина сутки работает под нагрузкой. Каждый экземпляр уходит с результатами тестов на нагрев и стабильность, так что вы знаете, что показала именно эта машина, а не что должна уметь модель.",
      en: "Assembled, cable-managed and burned in for 24 hours before it ships. Every unit leaves with its thermal and stability test results attached, so you know what this specific machine did rather than what the model is supposed to do.",
    },
    warrantyMonths: 36,
    specs: [
      {
        group: "processor",
        name: "model",
        value: "AMD Ryzen 7 7800X3D",
        unit: null,
      },
      {
        group: "graphics",
        name: "model",
        value: "NVIDIA RTX 4080 Super",
        unit: null,
      },
      { group: "memory", name: "capacity", value: "32", unit: "GB" },
      { group: "storage", name: "capacity", value: "2", unit: "TB" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000008",
    slug: "asus-rog-strix-g16-gaming-laptop",
    sku: "LAP-ASUS-G16",
    name: modelName("ASUS ROG Strix G16 Gaming Laptop"),
    brand: "ASUS",
    category: "laptops",
    image: "products/lap-asus-rog-g16.webp",
    imageAlt: {
      uz: "ASUS ROG Strix G16 o'yin noutbuki",
      ru: "Игровой ноутбук ASUS ROG Strix G16",
      en: "ASUS ROG Strix G16 gaming laptop",
    },
    priceCents: 199900,
    salePriceCents: 179900,
    rating: 4.5,
    reviewCount: 87,
    stock: 14,
    badges: [],
    shortDescription: {
      uz: "RTX 4070 videokartali 16 dyuymli 240 Hz o'yin noutbuki.",
      ru: "Шестнадцатидюймовый игровой ноутбук с экраном 240 Гц и RTX 4070.",
      en: "Sixteen-inch 240Hz gaming laptop with RTX 4070.",
    },
    description: {
      uz: "240 Hz ekran va uni to'liq ishlata oladigan videokarta. Sovutgichi kuchli, uzoq o'ynaganda ham korpus ortiqcha qizimaydi.",
      ru: "Панель на 240 Гц и достаточно мощная видеокарта, чтобы реально использовать эту частоту в родном разрешении, плюс охлаждение, при котором корпус остаётся комфортным на ощупь.",
      en: "A 240Hz panel with enough GPU behind it to actually use the refresh rate at native resolution, and a cooling design that keeps the chassis usable while it does.",
    },
    warrantyMonths: 24,
    specs: [
      { group: "display", name: "size", value: "16", unit: "in" },
      { group: "display", name: "refreshRate", value: "240", unit: "Hz" },
      {
        group: "graphics",
        name: "model",
        value: "NVIDIA RTX 4070 Laptop",
        unit: null,
      },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000009",
    slug: "razer-deathadder-v3-pro",
    sku: "MOU-RAZ-DAV3",
    name: modelName("Razer DeathAdder V3 Pro"),
    brand: "Razer",
    category: "accessories",
    image: "products/mou-razer-deathadder-v3.webp",
    imageAlt: {
      uz: "Razer DeathAdder V3 Pro simsiz sichqonchasi",
      ru: "Беспроводная мышь Razer DeathAdder V3 Pro",
      en: "Razer DeathAdder V3 Pro wireless mouse",
    },
    priceCents: 14900,
    salePriceCents: null,
    rating: 4.7,
    reviewCount: 412,
    stock: 0,
    badges: [],
    shortDescription: {
      uz: "Og'irligi 63 gramm bo'lgan simsiz o'yin sichqonchasi.",
      ru: "Беспроводная киберспортивная мышь массой 63 грамма.",
      en: "Wireless esports mouse at 63 grams.",
    },
    description: {
      uz: "Og'irligi 63 gramm, korpusida teshik yo'q. Bir marta zaryadlansa, bir ish haftasiga yetadi.",
      ru: "Шестьдесят три грамма без перфорации корпуса и батарея, которой хватает на рабочую неделю между зарядками.",
      en: "Sixty-three grams without drilling holes in the shell, and a battery that lasts a working week between charges.",
    },
    warrantyMonths: 24,
    specs: [
      { group: "sensor", name: "resolution", value: "30000", unit: "DPI" },
      { group: "physical", name: "weight", value: "63", unit: "g" },
      { group: "battery", name: "life", value: "90", unit: "h" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000010",
    slug: "bondo-atlas-workstation",
    sku: "PC-ATLAS-WS",
    name: {
      uz: "Bondo Atlas ish stansiyasi",
      ru: "Рабочая станция Bondo Atlas",
      en: "Bondo Atlas Workstation",
    },
    brand: "Bondo",
    category: "gaming-pcs",
    image: "products/pc-atlas-workstation.webp",
    imageAlt: {
      uz: "Bondo Atlas ish stansiyasi korpusi",
      ru: "Рабочая станция Bondo Atlas в корпусе-башне",
      en: "Bondo Atlas workstation tower",
    },
    priceCents: 399900,
    salePriceCents: null,
    rating: 4.8,
    reviewCount: 22,
    stock: 4,
    badges: ["low-stock"],
    shortDescription: {
      uz: "Render va hisob-kitob ishlari uchun Threadripper kompyuteri.",
      ru: "Рабочая станция на Threadripper для симуляций и рендеринга.",
      en: "Threadripper workstation for simulation and rendering.",
    },
    description: {
      uz: "Soatlab davom etadigan render va hisob-kitob ishlari uchun yig'ilgan. ECC xotira o'rnatilgan, sovutgichi barcha yadrolar uzluksiz ishlaganda ham yetarli.",
      ru: "Создана для задач, которые считаются часами, а не секундами. Память с ECC по всей системе и охлаждение, рассчитанное на продолжительную нагрузку на все ядра, а не на короткие бенчмарки.",
      en: "Built for work that runs for hours rather than seconds. ECC memory throughout and a cooling design rated for sustained all-core load, not burst benchmarks.",
    },
    warrantyMonths: 36,
    specs: [
      {
        group: "processor",
        name: "model",
        value: "AMD Threadripper 7970X",
        unit: null,
      },
      { group: "memory", name: "capacity", value: "128", unit: "GB ECC" },
      { group: "storage", name: "capacity", value: "4", unit: "TB" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000011",
    slug: "asus-proart-display-pa279crv",
    sku: "MON-ASUS-PA279",
    name: modelName("ASUS ProArt Display PA279CRV"),
    brand: "ASUS",
    category: "accessories",
    image: "products/mon-asus-proart.webp",
    imageAlt: {
      uz: "ASUS ProArt 27 dyuymli monitori",
      ru: "27-дюймовый монитор ASUS ProArt",
      en: "ASUS ProArt 27-inch monitor",
    },
    priceCents: 49900,
    salePriceCents: 42900,
    rating: 4.6,
    reviewCount: 118,
    stock: 19,
    badges: [],
    shortDescription: {
      uz: "Rangi kalibrlangan 27 dyuymli 4K monitor.",
      ru: "Двадцатисемидюймовый монитор 4K с заводской калибровкой цвета.",
      en: "Twenty-seven-inch 4K monitor, colour calibrated.",
    },
    description: {
      uz: "Har bir monitor alohida kalibrlanadi va hisoboti quti ichida keladi. Adobe RGB qamrovi 99%. USB-C bitta kabel orqali tasvir, ma'lumot va 96 Vt quvvat uzatadi.",
      ru: "Поставляется с индивидуальным отчётом о калибровке и покрывает 99% Adobe RGB. USB-C передаёт изображение, данные и 96 Вт питания по одному кабелю.",
      en: "Ships with a per-unit calibration report and covers 99% of Adobe RGB. USB-C carries display, data and 96W of power on one cable.",
    },
    warrantyMonths: 36,
    specs: [
      { group: "display", name: "size", value: "27", unit: "in" },
      {
        group: "display",
        name: "resolution",
        value: "3840 x 2160",
        unit: null,
      },
      { group: "colour", name: "adobeRgb", value: "99", unit: "%" },
    ],
  },
  {
    id: "c0000000-0000-4000-8000-000000000012",
    slug: "intel-core-i9-14900k",
    sku: "CPU-I9-14900K",
    name: modelName("Intel Core i9-14900K"),
    brand: "Intel",
    category: "components",
    image: "products/cpu-intel-i9-14900k.webp",
    imageAlt: {
      uz: "Intel Core i9-14900K ish stoli protsessori",
      ru: "Настольный процессор Intel Core i9-14900K",
      en: "Intel Core i9-14900K desktop processor",
    },
    priceCents: 58900,
    salePriceCents: 52900,
    rating: 4.3,
    reviewCount: 143,
    stock: 31,
    badges: [],
    shortDescription: {
      uz: "LGA1700 soketidagi 24 yadroli ish stoli protsessori.",
      ru: "24-ядерный настольный процессор для сокета LGA1700.",
      en: "24-core desktop processor on socket LGA1700.",
    },
    description: {
      uz: "Sakkizta kuchli va o'n oltita tejamkor yadro. Bitta yadrodagi tezligi yuqori, shuning uchun eski o'yinlarda ham kadrlar soni yaxshi chiqadi.",
      ru: "Восемь производительных и шестнадцать энергоэффективных ядер плюс преимущество в однопоточной производительности, которое до сих пор определяет частоту кадров в старых движках.",
      en: "Eight performance cores and sixteen efficiency cores, with the single-threaded lead that still decides frame rates in older engines.",
    },
    warrantyMonths: 36,
    specs: [
      { group: "cores", name: "coreCount", value: "24", unit: null },
      { group: "clocks", name: "boostClock", value: "6.0", unit: "GHz" },
      { group: "platform", name: "socket", value: "LGA1700", unit: null },
    ],
  },
];

/**
 * Stand-in reviews. Localized here because they are marketing copy, not real
 * customer writing — a genuine review is never translated (see `types/catalog.ts`).
 */
export const reviews: Review[] = [
  {
    id: "r1",
    author: "Sardor Qodirov",
    initials: "SQ",
    rating: 5,
    title: {
      uz: "Sinovdan o'tkazilgan holda keldi",
      ru: "Приехал уже протестированным",
      en: "Arrived tested, not just assembled",
    },
    body: {
      uz: "Quti ichida sinov hisoboti bor edi, unda aynan mening kompyuterimning haroratlari yozilgan. Bunday qiladigan boshqa do'kon ko'rmadim.",
      ru: "В коробке лежал отчёт с реальными температурами моего компьютера. Раньше мне такого ни один магазин не давал.",
      en: "The box had a test report in it with the real temperatures for my machine. No other shop I've bought from does that.",
    },
    productName: "Bondo Forge RTX 4080 Gaming PC",
    verified: true,
  },
  {
    id: "r2",
    author: "Nigora Aliyeva",
    initials: "NA",
    rating: 5,
    title: {
      uz: "Kerakli qism, yaxshi qadoq",
      ru: "Нужная деталь, нормальная упаковка",
      en: "Right part, packed properly",
    },
    body: {
      uz: "Seshanba kuni buyurtma berdim, payshanba kuni o'rnatdim. Karta ikki qavat qutida, ulagichi mahkamlangan holda keldi. Hamma do'kon bunday qadoqlamaydi.",
      ru: "Заказала во вторник, в четверг уже поставила. Карта пришла в двойной коробке, разъём зафиксирован. Так упаковывают далеко не везде.",
      en: "Ordered Tuesday, installed Thursday. The card came double-boxed with the connector held in place. Not every shop bothers.",
    },
    productName: "NVIDIA GeForce RTX 4090 Founders Edition",
    verified: true,
  },
  {
    id: "r3",
    author: "Jasur Rahimov",
    initials: "JR",
    rating: 4,
    title: {
      uz: "Moslik haqidagi savolga aniq javob berishdi",
      ru: "На вопрос о совместимости ответили по делу",
      en: "They actually answered my compatibility question",
    },
    body: {
      uz: "Bu to'plam kulerimga xalaqit bermaydimi deb so'radim. Havola tashlamadilar, balandligini millimetrda aytishdi.",
      ru: "Спросил, пройдёт ли комплект под мой кулер. Вместо ссылки на товар назвали высоту в миллиметрах.",
      en: "I asked whether the kit would fit under my cooler. They gave me the height in millimetres instead of a link.",
    },
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
