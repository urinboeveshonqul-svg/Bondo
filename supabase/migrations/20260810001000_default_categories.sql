-- =============================================================================
-- The catalog's default categories
-- =============================================================================
-- Twenty top-level categories, in three languages, inserted by a migration
-- rather than by `supabase/seed.sql`.
--
-- **This is not a violation of ADR-20.** That rule forbids *fake* data —
-- invented products, lorem ipsum, seeded reviews nobody wrote — because fake
-- data hides the empty states where an ecommerce UI actually breaks. A category
-- tree is not fake: it is the shop's own taxonomy, decided by the business, and
-- a computer store that sells laptops has a Laptops category on the day it
-- opens. It belongs with the roles and permissions in
-- `20260801000200_identity_and_rbac.sql`, which are inserted the same way and
-- for the same reason (**ADR-68**).
--
-- The distinction that matters: `seed.sql` is development fixture data and never
-- runs on `db push` (ADR-25). Reference data the application cannot function
-- without goes in a migration, so a fresh deployment has it.
--
-- -----------------------------------------------------------------------------
-- Flat, and deliberately so
-- -----------------------------------------------------------------------------
-- Several of these are naturally children of a "components" parent, and the
-- schema has supported unlimited nesting since Phase 2 — `parent_id`, a
-- trigger-maintained `path`, and cycle rejection. They are inserted flat because
-- that is the list the business gave. Inventing a hierarchy nobody asked for is
-- the speculation CLAUDE.md § 3 rules out, and an operator can nest any of them
-- from the admin without a migration, which is the point of the column.
--
-- -----------------------------------------------------------------------------
-- Slugs are per locale
-- -----------------------------------------------------------------------------
-- `category_translations.slug` is unique per locale, so each language gets a URL
-- a reader of that language can recognise: `/uz/products?category=noutbuklar`,
-- `/ru/...=noutbuki`, `/en/...=laptops`. Apostrophes are dropped rather than
-- transliterated — `is_valid_slug` allows only lowercase alphanumerics and
-- single hyphens, and `o'yin` is `oyin` in a URL everywhere it appears.
--
-- -----------------------------------------------------------------------------
-- Idempotent
-- -----------------------------------------------------------------------------
-- `on conflict do nothing` throughout, keyed on the per-locale slug. Re-running
-- this migration against a database that already has these categories is a
-- no-op, and an operator who renamed one keeps their name.
-- =============================================================================

-- One temporary table rather than twenty repeated inserts: the names and slugs
-- are data, and writing them as data means the insert below is read once instead
-- of twenty times.
create temporary table _default_categories (
  position integer,
  uz_name text, uz_slug text,
  ru_name text, ru_slug text,
  en_name text, en_slug text
) on commit drop;

insert into _default_categories values
  (1,  'Noutbuklar',                   'noutbuklar',
       'Ноутбуки',                     'noutbuki',
       'Laptops',                      'laptops'),
  (2,  'Tayyor kompyuterlar',          'tayyor-kompyuterlar',
       'Готовые компьютеры',           'gotovye-kompyutery',
       'Desktop computers',            'desktop-computers'),
  (3,  'O''yin kompyuterlari',         'oyin-kompyuterlari',
       'Игровые компьютеры',           'igrovye-kompyutery',
       'Gaming PCs',                   'gaming-pcs'),
  (4,  'Protsessorlar',                'protsessorlar',
       'Процессоры',                   'protsessory',
       'Processors',                   'processors'),
  (5,  'Videokartalar',                'videokartalar',
       'Видеокарты',                   'videokarty',
       'Graphics cards',               'graphics-cards'),
  (6,  'Ona platalar',                 'ona-platalar',
       'Материнские платы',            'materinskie-platy',
       'Motherboards',                 'motherboards'),
  (7,  'Operativ xotira',              'operativ-xotira',
       'Оперативная память',           'operativnaya-pamyat',
       'Memory',                       'memory'),
  -- SSD, HDD, USB and the rest stay exactly as they are in every language
  -- (CLAUDE.md § 11a). A shopper searching for "SSD" will not find "ССД".
  (8,  'SSD',                          'ssd',
       'SSD',                          'ssd',
       'SSD',                          'ssd'),
  (9,  'HDD',                          'hdd',
       'HDD',                          'hdd',
       'HDD',                          'hdd'),
  (10, 'Quvvat manbalari',             'quvvat-manbalari',
       'Блоки питания',                'bloki-pitaniya',
       'Power supplies',               'power-supplies'),
  (11, 'Kompyuter korpuslari',         'kompyuter-korpuslari',
       'Корпуса',                      'korpusa',
       'Cases',                        'cases'),
  -- "Sovutish tizimlari" is the natural Uzbek term for cooling and is the one
  -- exception the vocabulary rule names explicitly.
  (12, 'Sovutish tizimlari',           'sovutish-tizimlari',
       'Системы охлаждения',           'sistemy-ohlazhdeniya',
       'Cooling',                      'cooling'),
  (13, 'Monitorlar',                   'monitorlar',
       'Мониторы',                     'monitory',
       'Monitors',                     'monitors'),
  (14, 'Klaviaturalar',                'klaviaturalar',
       'Клавиатуры',                   'klaviatury',
       'Keyboards',                    'keyboards'),
  (15, 'Sichqonchalar',                'sichqonchalar',
       'Мыши',                         'myshi',
       'Mice',                         'mice'),
  (16, 'Quloqchinlar',                 'quloqchinlar',
       'Наушники',                     'naushniki',
       'Headsets',                     'headsets'),
  (17, 'Printerlar',                   'printerlar',
       'Принтеры',                     'printery',
       'Printers',                     'printers'),
  (18, 'Router va tarmoq uskunalari',  'router-va-tarmoq-uskunalari',
       'Роутеры и сетевое оборудование', 'setevoe-oborudovanie',
       'Networking',                   'networking'),
  (19, 'Server uskunalari',            'server-uskunalari',
       'Серверное оборудование',       'servernoe-oborudovanie',
       'Server hardware',              'server-hardware'),
  (20, 'Aksessuarlar',                 'aksessuarlar',
       'Аксессуары',                   'aksessuary',
       'Accessories',                  'accessories');

-- -----------------------------------------------------------------------------
-- Insert, skipping anything already present
-- -----------------------------------------------------------------------------
-- Presence is decided on the **Uzbek slug**, because Uzbek is the master
-- language and its slug is the one that cannot be absent. Checking the parent
-- table would not work: `categories` carries no name or slug at all since the
-- localization migration, so there is nothing on it to match against.
do $$
declare
  row_data record;
  new_id uuid;
begin
  for row_data in select * from _default_categories order by position
  loop
    if exists (
      select 1 from public.category_translations
      where locale = 'uz' and slug = row_data.uz_slug
    ) then
      continue;
    end if;

    insert into public.categories (display_order, is_visible)
    values (row_data.position, true)
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
