-- =============================================================================
-- The category taxonomy: a real two-level tree, and the columns it needs
-- =============================================================================
-- Two things happen here, and they are separable on purpose.
--
--   1. `categories` gains `icon` and `is_featured`. Both are presentation
--      decisions an operator makes, and neither had a column — the admin screen
--      could not offer them and the storefront could not render them.
--   2. The flat twenty categories shipped by `20260810001000_default_categories`
--      (ADR-68) are replaced by the twelve-department tree the business actually
--      sells from: 12 top-level departments and 90 subcategories, in uz/ru/en,
--      with a slug per locale.
--
-- **ADR-72 supersedes ADR-68.** The reasoning that put the taxonomy in a
-- migration rather than in `seed.sql` has not changed and is not being reversed:
-- a category tree is the shop's own reference data, `seed.sql` never runs on
-- `db push` (ADR-25), and a fresh deployment must come up with a navigable shop.
-- What changed is the *shape*: ADR-68 inserted the list flat because that was
-- the list the business gave, and explicitly said an operator could nest it from
-- the admin. The business has now given the hierarchy, so it ships as one.
--
-- Nothing here changes the nesting mechanism. `parent_id`, the trigger-
-- maintained `path`, the cycle rejection and the descendant rebuild have all
-- worked since Phase 2 and support unlimited depth. Two levels is the data;
-- the schema imposes no limit and the admin can add a third without a migration.
--
-- -----------------------------------------------------------------------------
-- Why the old defaults are removed rather than re-parented
-- -----------------------------------------------------------------------------
-- Most of the twenty map onto a node in the new tree, but not all of them do the
-- same way: `Tayyor kompyuterlar` was a department and stays one, `Protsessorlar`
-- was a department and becomes a child of Components, and `Sovutish tizimlari`
-- splits into CPU coolers and case fans. Re-parenting in place would leave the
-- database holding a mixture of the two designs that nobody could describe.
--
-- The removal is **guarded three ways** and is a no-op unless all three hold:
--
--   * the row still carries the exact Uzbek slug the ADR-68 migration gave it,
--     so a category an operator renamed is left alone;
--   * no product references it, so nothing is uncategorised silently — and the
--     `on delete restrict` foreign key would refuse anyway;
--   * it has no children, so an operator who already built a hierarchy under it
--     keeps it.
--
-- A guard that fails means the tree is inserted alongside whatever survived,
-- which an operator can then tidy. That is the safe direction: a duplicate
-- category is visible and fixable in one screen, a deleted one is not.
--
-- -----------------------------------------------------------------------------
-- Idempotent
-- -----------------------------------------------------------------------------
-- Presence is decided on the Uzbek slug throughout, because Uzbek is the master
-- language (CLAUDE.md § 11a) and its slug is the one that cannot be absent.
-- Re-running against a database that already carries this tree inserts nothing,
-- and a category somebody renamed keeps their name.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- icon
-- -----------------------------------------------------------------------------
-- A lucide icon *name*, stored as text — the same decision as
-- `service_highlights.icon` and for the same three reasons (**ADR-69**):
--
--   * an upload turns a navigation glyph into an asset-management problem, and
--     lets an operator put a 900 kB PNG in the header;
--   * a database enum makes adding a glyph a migration, for a change that is
--     purely presentational;
--   * free text with no validation renders a hole when somebody types `Labtop`.
--
-- So the constraint enforces the *shape* of an identifier — it rejects markup,
-- paths and whitespace — and the Server Action enforces *membership* against
-- `CATEGORY_ICONS` in `components/layout/category-icon.tsx`, which is the same
-- map the storefront draws from. The component falls back to a neutral glyph for
-- a name that predates a rename, so a stale row is a wrong icon rather than a
-- broken menu.
alter table public.categories
  add column icon text,
  add column is_featured boolean not null default false;

alter table public.categories
  add constraint categories_icon_identifier check (
    icon is null or icon ~ '^[A-Za-z][A-Za-z0-9]{0,49}$'
  );

comment on column public.categories.icon is
  'Lucide icon name, validated for shape here and for membership in the Server Action. Not an upload and not an enum (ADR-69).';
comment on column public.categories.is_featured is
  'Promoted in the storefront navigation. Zero featured categories is a legitimate state and renders nothing.';

-- The mega menu reads the whole visible tree in display order on every page.
-- The predicate matches that read exactly, so the index covers the live,
-- visible rows rather than every soft-deleted one.
create index idx_categories_navigation
  on public.categories (parent_id, display_order)
  where deleted_at is null and is_visible;

comment on index public.idx_categories_navigation is
  'Serves the navigation read: visible, live categories in sibling order.';

-- -----------------------------------------------------------------------------
-- Retire the ADR-68 flat defaults
-- -----------------------------------------------------------------------------
do $$
declare
  old_slug text;
  target uuid;
begin
  foreach old_slug in array array[
    'noutbuklar', 'tayyor-kompyuterlar', 'oyin-kompyuterlari', 'protsessorlar',
    'videokartalar', 'ona-platalar', 'operativ-xotira', 'ssd', 'hdd',
    'quvvat-manbalari', 'kompyuter-korpuslari', 'sovutish-tizimlari',
    'monitorlar', 'klaviaturalar', 'sichqonchalar', 'quloqchinlar',
    'printerlar', 'router-va-tarmoq-uskunalari', 'server-uskunalari',
    'aksessuarlar'
  ]
  loop
    select ct.category_id into target
    from public.category_translations ct
    where ct.locale = 'uz' and ct.slug = old_slug;

    if target is null then
      continue;
    end if;

    -- Guard 2: something is filed under it.
    if exists (select 1 from public.products p where p.category_id = target) then
      continue;
    end if;

    -- Guard 3: an operator already nested something beneath it.
    if exists (select 1 from public.categories c where c.parent_id = target) then
      continue;
    end if;

    -- `category_translations` cascades; `products.category_id` is the only other
    -- reference and guard 2 has just proven there is none.
    delete from public.categories where id = target;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- The tree
-- -----------------------------------------------------------------------------
-- Written as data in one temporary table rather than as a hundred repeated
-- inserts, so the insert below is read once instead of a hundred times.
--
-- `parent_uz_slug` is null for a department and names the parent's Uzbek slug
-- otherwise. Rows are ordered so a parent is always inserted before its
-- children, which is what lets a single pass resolve the reference.
--
-- On the copy: this is three pieces of writing, not one translated twice
-- (CLAUDE.md § 11a). Each language uses the word its own shoppers type into a
-- search box — `Videokartalar` / `Видеокарты` / `Graphics cards`, `Quvvat
-- bloklari` / `Блоки питания` / `Power supplies`. Protected names do not move in
-- any language: SSD, HDD, NAS, USB, HDMI, DisplayPort, VGA, LAN, Wi-Fi,
-- Bluetooth, RGB, MacBook, Windows and Microsoft Office are spelled the same
-- everywhere, because a shopper searching for one will not find a
-- transliteration of it.
create temporary table _category_tree (
  position integer,
  parent_uz_slug text,
  icon text,
  uz_name text, uz_slug text,
  ru_name text, ru_slug text,
  en_name text, en_slug text
) on commit drop;

insert into _category_tree values
  -- 1. Computer builds ------------------------------------------------------
  (100, null, 'PcCase',
    'Tayyor kompyuterlar',       'tayyor-kompyuterlar',
    'Готовые компьютеры',        'gotovye-kompyutery',
    'Computer builds',           'computer-builds'),
  (101, 'tayyor-kompyuterlar', null,
    'O''yin kompyuterlari',      'oyin-kompyuterlari',
    'Игровые компьютеры',        'igrovye-kompyutery',
    'Gaming PCs',                'gaming-pcs'),
  (102, 'tayyor-kompyuterlar', null,
    'Ofis kompyuterlari',        'ofis-kompyuterlari',
    'Офисные компьютеры',        'ofisnye-kompyutery',
    'Office PCs',                'office-pcs'),
  (103, 'tayyor-kompyuterlar', null,
    'Uy kompyuterlari',          'uy-kompyuterlari',
    'Домашние компьютеры',       'domashnie-kompyutery',
    'Home PCs',                  'home-pcs'),
  (104, 'tayyor-kompyuterlar', null,
    'Ish stansiyalari',          'ish-stansiyalari',
    'Рабочие станции',           'rabochie-stantsii',
    'Workstations',              'workstations'),
  (105, 'tayyor-kompyuterlar', null,
    'Mini kompyuterlar',         'mini-kompyuterlar',
    'Мини-ПК',                   'mini-pk',
    'Mini PCs',                  'mini-pcs'),
  (106, 'tayyor-kompyuterlar', null,
    'Buyurtma asosida yig''ish', 'buyurtma-asosida-yigish',
    'Сборка на заказ',           'sborka-na-zakaz',
    'Custom builds',             'custom-builds'),

  -- 2. Laptops --------------------------------------------------------------
  (200, null, 'Laptop',
    'Noutbuklar',                'noutbuklar',
    'Ноутбуки',                  'noutbuki',
    'Laptops',                   'laptops'),
  (201, 'noutbuklar', null,
    'O''yin noutbuklari',        'oyin-noutbuklari',
    'Игровые ноутбуки',          'igrovye-noutbuki',
    'Gaming laptops',            'gaming-laptops'),
  (202, 'noutbuklar', null,
    'Ofis noutbuklari',          'ofis-noutbuklari',
    'Офисные ноутбуки',          'ofisnye-noutbuki',
    'Office laptops',            'office-laptops'),
  (203, 'noutbuklar', null,
    'Biznes noutbuklar',         'biznes-noutbuklar',
    'Бизнес-ноутбуки',           'biznes-noutbuki',
    'Business laptops',          'business-laptops'),
  (204, 'noutbuklar', null,
    'Talabalar uchun noutbuklar', 'talabalar-uchun-noutbuklar',
    'Ноутбуки для учёбы',        'noutbuki-dlya-ucheby',
    'Student laptops',           'student-laptops'),
  (205, 'noutbuklar', null,
    'Ultrabuklar',               'ultrabuklar',
    'Ультрабуки',                'ultrabuki',
    'Ultrabooks',                'ultrabooks'),
  (206, 'noutbuklar', null,
    'Transformer noutbuklar',    'transformer-noutbuklar',
    'Ноутбуки-трансформеры',     'noutbuki-transformery',
    '2-in-1 laptops',            '2-in-1-laptops'),
  (207, 'noutbuklar', null,
    'MacBook',                   'macbook',
    'MacBook',                   'macbook',
    'MacBooks',                  'macbooks'),
  (208, 'noutbuklar', null,
    'Boshqa noutbuklar',         'boshqa-noutbuklar',
    'Другие ноутбуки',           'drugie-noutbuki',
    'Other laptops',             'other-laptops'),

  -- 3. All-in-one PCs -------------------------------------------------------
  (300, null, 'Computer',
    'Monobloklar',               'monobloklar',
    'Моноблоки',                 'monobloki',
    'All-in-one PCs',            'all-in-one-pcs'),
  (301, 'monobloklar', null,
    'Uy uchun monobloklar',      'uy-uchun-monobloklar',
    'Моноблоки для дома',        'monobloki-dlya-doma',
    'Home all-in-ones',          'home-all-in-ones'),
  (302, 'monobloklar', null,
    'Ofis uchun monobloklar',    'ofis-uchun-monobloklar',
    'Моноблоки для офиса',       'monobloki-dlya-ofisa',
    'Business all-in-ones',      'business-all-in-ones'),
  (303, 'monobloklar', null,
    'Professional monobloklar',  'professional-monobloklar',
    'Профессиональные моноблоки', 'professionalnye-monobloki',
    'Professional all-in-ones',  'professional-all-in-ones'),

  -- 4. Monitors -------------------------------------------------------------
  (400, null, 'Monitor',
    'Monitorlar',                'monitorlar',
    'Мониторы',                  'monitory',
    'Monitors',                  'monitors'),
  (401, 'monitorlar', null,
    'O''yin monitorlari',        'oyin-monitorlari',
    'Игровые мониторы',          'igrovye-monitory',
    'Gaming monitors',           'gaming-monitors'),
  (402, 'monitorlar', null,
    'Ofis monitorlari',          'ofis-monitorlari',
    'Офисные мониторы',          'ofisnye-monitory',
    'Office monitors',           'office-monitors'),
  (403, 'monitorlar', null,
    'Professional monitorlar',   'professional-monitorlar',
    'Профессиональные мониторы', 'professionalnye-monitory',
    'Professional monitors',     'professional-monitors'),
  (404, 'monitorlar', null,
    'Ultrakeng monitorlar',      'ultrakeng-monitorlar',
    'Ультраширокие мониторы',    'ultrashirokie-monitory',
    'Ultrawide monitors',        'ultrawide-monitors'),
  (405, 'monitorlar', null,
    'Portativ monitorlar',       'portativ-monitorlar',
    'Портативные мониторы',      'portativnye-monitory',
    'Portable monitors',         'portable-monitors'),

  -- 5. Components -----------------------------------------------------------
  (500, null, 'Cpu',
    'Butlovchi qismlar',         'butlovchi-qismlar',
    'Комплектующие',             'komplektuyushchie',
    'PC components',             'pc-components'),
  (501, 'butlovchi-qismlar', null,
    'Protsessorlar',             'protsessorlar',
    'Процессоры',                'protsessory',
    'Processors',                'processors'),
  (502, 'butlovchi-qismlar', null,
    'Ona platalar',              'ona-platalar',
    'Материнские платы',         'materinskie-platy',
    'Motherboards',              'motherboards'),
  (503, 'butlovchi-qismlar', null,
    'Operativ xotira',           'operativ-xotira',
    'Оперативная память',        'operativnaya-pamyat',
    'Memory',                    'memory'),
  (504, 'butlovchi-qismlar', null,
    'Videokartalar',             'videokartalar',
    'Видеокарты',                'videokarty',
    'Graphics cards',            'graphics-cards'),
  (505, 'butlovchi-qismlar', null,
    'SSD',                       'ssd',
    'SSD',                       'ssd',
    'SSD',                       'ssd'),
  (506, 'butlovchi-qismlar', null,
    'HDD',                       'hdd',
    'HDD',                       'hdd',
    'HDD',                       'hdd'),
  (507, 'butlovchi-qismlar', null,
    'Quvvat bloklari',           'quvvat-bloklari',
    'Блоки питания',             'bloki-pitaniya',
    'Power supplies',            'power-supplies'),
  (508, 'butlovchi-qismlar', null,
    'Protsessor sovutgichlari',  'protsessor-sovutgichlari',
    'Кулеры для процессора',     'kulery-dlya-protsessora',
    'CPU coolers',               'cpu-coolers'),
  (509, 'butlovchi-qismlar', null,
    'Korpus ventilyatorlari',    'korpus-ventilyatorlari',
    'Корпусные вентиляторы',     'korpusnye-ventilyatory',
    'Case fans',                 'case-fans'),
  (510, 'butlovchi-qismlar', null,
    'Kompyuter korpuslari',      'kompyuter-korpuslari',
    'Корпуса',                   'korpusa',
    'Cases',                     'cases'),
  (511, 'butlovchi-qismlar', null,
    'Termopasta',                'termopasta',
    'Термопаста',                'termopasta',
    'Thermal paste',             'thermal-paste'),
  (512, 'butlovchi-qismlar', null,
    'Tarmoq kartalari',          'tarmoq-kartalari',
    'Сетевые карты',             'setevye-karty',
    'Network cards',             'network-cards'),
  (513, 'butlovchi-qismlar', null,
    'Ovoz kartalari',            'ovoz-kartalari',
    'Звуковые карты',            'zvukovye-karty',
    'Sound cards',               'sound-cards'),
  (514, 'butlovchi-qismlar', null,
    'Optik disk qurilmalari',    'optik-disk-qurilmalari',
    'Оптические приводы',        'opticheskie-privody',
    'Optical drives',            'optical-drives'),
  (515, 'butlovchi-qismlar', null,
    'Boshqa butlovchi qismlar',  'boshqa-butlovchi-qismlar',
    'Другие комплектующие',      'drugie-komplektuyushchie',
    'Other components',          'other-components'),

  -- 6. Gaming ---------------------------------------------------------------
  (600, null, 'Gamepad2',
    'Geymerlar uchun',           'geymerlar-uchun',
    'Для геймеров',              'dlya-geimerov',
    'Gaming',                    'gaming'),
  (601, 'geymerlar-uchun', null,
    'O''yin klaviaturalari',     'oyin-klaviaturalari',
    'Игровые клавиатуры',        'igrovye-klaviatury',
    'Gaming keyboards',          'gaming-keyboards'),
  (602, 'geymerlar-uchun', null,
    'O''yin sichqonchalari',     'oyin-sichqonchalari',
    'Игровые мыши',              'igrovye-myshi',
    'Gaming mice',               'gaming-mice'),
  (603, 'geymerlar-uchun', null,
    'O''yin quloqchinlari',      'oyin-quloqchinlari',
    'Игровые наушники',          'igrovye-naushniki',
    'Gaming headsets',           'gaming-headsets'),
  (604, 'geymerlar-uchun', null,
    'O''yin kreslolari',         'oyin-kreslolari',
    'Игровые кресла',            'igrovye-kresla',
    'Gaming chairs',             'gaming-chairs'),
  (605, 'geymerlar-uchun', null,
    'Geympadlar',                'geympadlar',
    'Геймпады',                  'geimpady',
    'Controllers',               'controllers'),
  (606, 'geymerlar-uchun', null,
    'O''yin rullari',            'oyin-rullari',
    'Игровые рули',              'igrovye-ruli',
    'Racing wheels',             'racing-wheels'),
  (607, 'geymerlar-uchun', null,
    'RGB yoritish',              'rgb-yoritish',
    'RGB-подсветка',             'rgb-podsvetka',
    'RGB lighting',              'rgb-lighting'),

  -- 7. Accessories ----------------------------------------------------------
  (700, null, 'Headphones',
    'Aksessuarlar',              'aksessuarlar',
    'Аксессуары',                'aksessuary',
    'Accessories',               'accessories'),
  (701, 'aksessuarlar', null,
    'Klaviaturalar',             'klaviaturalar',
    'Клавиатуры',                'klaviatury',
    'Keyboards',                 'keyboards'),
  (702, 'aksessuarlar', null,
    'Sichqonchalar',             'sichqonchalar',
    'Мыши',                      'myshi',
    'Mice',                      'mice'),
  (703, 'aksessuarlar', null,
    'Sichqoncha kilimchalari',   'sichqoncha-kilimchalari',
    'Коврики для мыши',          'kovriki-dlya-myshi',
    'Mouse pads',                'mouse-pads'),
  (704, 'aksessuarlar', null,
    'Quloqchinlar',              'quloqchinlar',
    'Наушники',                  'naushniki',
    'Headphones',                'headphones'),
  (705, 'aksessuarlar', null,
    'Kolonkalar',                'kolonkalar',
    'Колонки',                   'kolonki',
    'Speakers',                  'speakers'),
  (706, 'aksessuarlar', null,
    'Mikrofonlar',               'mikrofonlar',
    'Микрофоны',                 'mikrofony',
    'Microphones',               'microphones'),
  (707, 'aksessuarlar', null,
    'Veb-kameralar',             'veb-kameralar',
    'Веб-камеры',                'veb-kamery',
    'Webcams',                   'webcams'),
  (708, 'aksessuarlar', null,
    'HDMI kabellar',             'hdmi-kabellar',
    'Кабели HDMI',               'kabeli-hdmi',
    'HDMI cables',               'hdmi-cables'),
  (709, 'aksessuarlar', null,
    'DisplayPort kabellar',      'displayport-kabellar',
    'Кабели DisplayPort',        'kabeli-displayport',
    'DisplayPort cables',        'displayport-cables'),
  (710, 'aksessuarlar', null,
    'VGA kabellar',              'vga-kabellar',
    'Кабели VGA',                'kabeli-vga',
    'VGA cables',                'vga-cables'),
  (711, 'aksessuarlar', null,
    'USB kabellar',              'usb-kabellar',
    'Кабели USB',                'kabeli-usb',
    'USB cables',                'usb-cables'),
  (712, 'aksessuarlar', null,
    'USB hublar',                'usb-hublar',
    'USB-хабы',                  'usb-haby',
    'USB hubs',                  'usb-hubs'),
  (713, 'aksessuarlar', null,
    'Karta o''qigichlar',        'karta-oqigichlar',
    'Картридеры',                'kartridery',
    'Card readers',              'card-readers'),
  (714, 'aksessuarlar', null,
    'Noutbuk sumkalari',         'noutbuk-sumkalari',
    'Сумки для ноутбуков',       'sumki-dlya-noutbukov',
    'Laptop bags',               'laptop-bags'),
  (715, 'aksessuarlar', null,
    'Noutbuk sovutgichlari',     'noutbuk-sovutgichlari',
    'Подставки с охлаждением',   'podstavki-s-ohlazhdeniem',
    'Cooling pads',              'cooling-pads'),
  (716, 'aksessuarlar', null,
    'Flesh xotiralar',           'flesh-xotiralar',
    'Флешки',                    'fleshki',
    'Flash drives',              'flash-drives'),
  (717, 'aksessuarlar', null,
    'Xotira kartalari',          'xotira-kartalari',
    'Карты памяти',              'karty-pamyati',
    'Memory cards',              'memory-cards'),
  (718, 'aksessuarlar', null,
    'Tozalash vositalari',       'tozalash-vositalari',
    'Средства для чистки',       'sredstva-dlya-chistki',
    'Cleaning kits',             'cleaning-kits'),
  (719, 'aksessuarlar', null,
    'Boshqa aksessuarlar',       'boshqa-aksessuarlar',
    'Другие аксессуары',         'drugie-aksessuary',
    'Other accessories',         'other-accessories'),

  -- 8. Networking -----------------------------------------------------------
  (800, null, 'Wifi',
    'Tarmoq uskunalari',         'tarmoq-uskunalari',
    'Сетевое оборудование',      'setevoe-oborudovanie',
    'Networking',                'networking'),
  (801, 'tarmoq-uskunalari', null,
    'Wi-Fi routerlar',           'wi-fi-routerlar',
    'Wi-Fi роутеры',             'wi-fi-routery',
    'Wi-Fi routers',             'wi-fi-routers'),
  (802, 'tarmoq-uskunalari', null,
    'Mesh tizimlar',             'mesh-tizimlar',
    'Mesh-системы',              'mesh-sistemy',
    'Mesh systems',              'mesh-systems'),
  (803, 'tarmoq-uskunalari', null,
    'Kirish nuqtalari',          'kirish-nuqtalari',
    'Точки доступа',             'tochki-dostupa',
    'Access points',             'access-points'),
  (804, 'tarmoq-uskunalari', null,
    'Kommutatorlar',             'kommutatorlar',
    'Коммутаторы',               'kommutatory',
    'Switches',                  'switches'),
  (805, 'tarmoq-uskunalari', null,
    'Modemlar',                  'modemlar',
    'Модемы',                    'modemy',
    'Modems',                    'modems'),
  (806, 'tarmoq-uskunalari', null,
    'LAN kabellar',              'lan-kabellar',
    'Кабели LAN',                'kabeli-lan',
    'LAN cables',                'lan-cables'),
  (807, 'tarmoq-uskunalari', null,
    'Wi-Fi adapterlar',          'wi-fi-adapterlar',
    'Wi-Fi адаптеры',            'wi-fi-adaptery',
    'Wi-Fi adapters',            'wi-fi-adapters'),
  (808, 'tarmoq-uskunalari', null,
    'Bluetooth adapterlar',      'bluetooth-adapterlar',
    'Bluetooth-адаптеры',        'bluetooth-adaptery',
    'Bluetooth adapters',        'bluetooth-adapters'),

  -- 9. Printers and scanners ------------------------------------------------
  (900, null, 'Printer',
    'Printer va skanerlar',      'printer-va-skanerlar',
    'Принтеры и сканеры',        'printery-i-skanery',
    'Printers and scanners',     'printers-and-scanners'),
  (901, 'printer-va-skanerlar', null,
    'Lazerli printerlar',        'lazerli-printerlar',
    'Лазерные принтеры',         'lazernye-printery',
    'Laser printers',            'laser-printers'),
  (902, 'printer-va-skanerlar', null,
    'Siyohli printerlar',        'siyohli-printerlar',
    'Струйные принтеры',         'struinye-printery',
    'Inkjet printers',           'inkjet-printers'),
  (903, 'printer-va-skanerlar', null,
    'Ko''p vazifali printerlar', 'kop-vazifali-printerlar',
    'МФУ',                       'mfu',
    'All-in-one printers',       'all-in-one-printers'),
  (904, 'printer-va-skanerlar', null,
    'Termal printerlar',         'termal-printerlar',
    'Термопринтеры',             'termoprintery',
    'Thermal printers',          'thermal-printers'),
  (905, 'printer-va-skanerlar', null,
    'Skanerlar',                 'skanerlar',
    'Сканеры',                   'skanery',
    'Scanners',                  'scanners'),
  (906, 'printer-va-skanerlar', null,
    'Kartrijlar',                'kartrijlar',
    'Картриджи',                 'kartridzhi',
    'Ink cartridges',            'ink-cartridges'),
  (907, 'printer-va-skanerlar', null,
    'Tonerlar',                  'tonerlar',
    'Тонеры',                    'tonery',
    'Toner',                     'toner'),
  (908, 'printer-va-skanerlar', null,
    'Printer aksessuarlari',     'printer-aksessuarlari',
    'Аксессуары для принтеров',  'aksessuary-dlya-printerov',
    'Printer accessories',       'printer-accessories'),

  -- 10. Storage -------------------------------------------------------------
  (1000, null, 'HardDrive',
    'Xotira qurilmalari',        'xotira-qurilmalari',
    'Накопители',                'nakopiteli',
    'Storage',                   'storage'),
  (1001, 'xotira-qurilmalari', null,
    'Tashqi SSD',                'tashqi-ssd',
    'Внешние SSD',               'vneshnie-ssd',
    'External SSD',              'external-ssd'),
  (1002, 'xotira-qurilmalari', null,
    'Tashqi HDD',                'tashqi-hdd',
    'Внешние HDD',               'vneshnie-hdd',
    'External HDD',              'external-hdd'),
  (1003, 'xotira-qurilmalari', null,
    'NAS qurilmalar',            'nas-qurilmalar',
    'NAS-хранилища',             'nas-hranilishcha',
    'NAS',                       'nas'),
  (1004, 'xotira-qurilmalari', null,
    'USB flesh xotiralar',       'usb-flesh-xotiralar',
    'USB-флешки',                'usb-fleshki',
    'USB flash drives',          'usb-flash-drives'),
  (1005, 'xotira-qurilmalari', null,
    'SD xotira kartalari',       'sd-xotira-kartalari',
    'Карты памяти SD',           'karty-pamyati-sd',
    'SD memory cards',           'sd-memory-cards'),
  (1006, 'xotira-qurilmalari', null,
    'Zaxira nusxa qurilmalari',  'zaxira-nusxa-qurilmalari',
    'Диски для резервных копий', 'diski-dlya-rezervnyh-kopii',
    'Backup drives',             'backup-drives'),

  -- 11. Software ------------------------------------------------------------
  (1100, null, 'Disc',
    'Dasturiy ta''minot',        'dasturiy-taminot',
    'Программное обеспечение',   'programmnoe-obespechenie',
    'Software',                  'software'),
  (1101, 'dasturiy-taminot', null,
    'Windows',                   'windows',
    'Windows',                   'windows',
    'Windows',                   'windows'),
  (1102, 'dasturiy-taminot', null,
    'Microsoft Office',          'microsoft-office',
    'Microsoft Office',          'microsoft-office',
    'Microsoft Office',          'microsoft-office'),
  (1103, 'dasturiy-taminot', null,
    'Antiviruslar',              'antiviruslar',
    'Антивирусы',                'antivirusy',
    'Antivirus',                 'antivirus'),
  (1104, 'dasturiy-taminot', null,
    'Yordamchi dasturlar',       'yordamchi-dasturlar',
    'Утилиты',                   'utility',
    'Utilities',                 'utilities'),
  (1105, 'dasturiy-taminot', null,
    'Litsenziyalar',             'litsenziyalar',
    'Лицензии',                  'litsenzii',
    'Licences',                  'licences'),

  -- 12. Other ---------------------------------------------------------------
  -- Deliberately empty of children. It exists so an operator has somewhere to
  -- file a product that genuinely fits nowhere, rather than forcing it into a
  -- department where a shopper will not look for it.
  (1200, null, 'Package',
    'Boshqa mahsulotlar',        'boshqa-mahsulotlar',
    'Прочие товары',             'prochie-tovary',
    'Other',                     'other');

-- -----------------------------------------------------------------------------
-- Insert, skipping anything already present
-- -----------------------------------------------------------------------------
-- One pass. `_category_tree` is ordered so a department is always inserted
-- before the subcategories that name it, so `parent_id` resolves by lookup
-- rather than needing a second pass or a recursive CTE.
--
-- `display_order` is the position within the sibling group, not a global
-- sequence: the admin reorders siblings, and a global number would make moving
-- one department renumber every subcategory in the shop.
do $$
declare
  row_data record;
  parent_id_value uuid;
  new_id uuid;
  sibling_order integer;
begin
  for row_data in select * from _category_tree order by position
  loop
    -- Already there: a re-run, or a name an operator kept. Leave it alone.
    if exists (
      select 1 from public.category_translations
      where locale = 'uz' and slug = row_data.uz_slug
    ) then
      continue;
    end if;

    if row_data.parent_uz_slug is null then
      parent_id_value := null;
    else
      select ct.category_id into parent_id_value
      from public.category_translations ct
      where ct.locale = 'uz' and ct.slug = row_data.parent_uz_slug;

      -- The parent is missing only if one of the three retirement guards held
      -- and left a differently-shaped tree behind. Filing the child at the top
      -- level keeps it reachable and visible to whoever tidies up; dropping it
      -- would lose a category silently.
      if parent_id_value is null then
        raise notice 'category % has no parent %, inserting at the top level',
          row_data.uz_slug, row_data.parent_uz_slug;
      end if;
    end if;

    select coalesce(max(c.display_order), 0) + 1 into sibling_order
    from public.categories c
    where c.parent_id is not distinct from parent_id_value
      and c.deleted_at is null;

    insert into public.categories (parent_id, display_order, is_visible, icon)
    values (parent_id_value, sibling_order, true, row_data.icon)
    returning id into new_id;

    insert into public.category_translations (category_id, locale, name, slug)
    values
      (new_id, 'uz', row_data.uz_name, row_data.uz_slug),
      (new_id, 'ru', row_data.ru_name, row_data.ru_slug),
      (new_id, 'en', row_data.en_name, row_data.en_slug)
    on conflict do nothing;
  end loop;
end;
$$;
