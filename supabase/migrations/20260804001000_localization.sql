-- =============================================================================
-- Localization: normalized translation tables
-- =============================================================================
-- Resolves K-15. The schema stored one `text` per content field while the
-- application modelled every one of them as three languages (ADR-39), so a
-- product could not be saved in Uzbek at all — the column did not exist.
--
-- Shape: one translation row per (entity, locale), with a composite primary
-- key. Not a `jsonb` blob, deliberately:
--
--   * A blob cannot be constrained. `name` being NOT NULL in Russian is a
--     check the database can enforce on a row and cannot enforce inside JSON.
--   * A blob cannot carry a per-locale `tsvector`. Full-text search is the
--     reason this matters most: one `simple` vector over three languages
--     stems none of them, and Russian searched against an English dictionary
--     silently returns nothing.
--   * A blob cannot have a unique index on a localized slug.
--   * `select name from … where locale = 'ru'` is a query. `value->>'ru'` is a
--     scan with no useful statistics.
--
-- **Breaking change.** The single-language columns are dropped from the parent
-- tables, not left alongside — two places to write a product name is the
-- duplicate concept this phase exists to remove. Existing rows are migrated to
-- the `en` translation before the columns go, in this migration, so no
-- deployment sees both shapes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- locale
-- -----------------------------------------------------------------------------
-- An enum rather than a `locales` reference table. Adding a language is
-- deliberately a migration, because it is never only a data change: it also
-- needs a `messages/<code>/` folder, a font subset, and a routing entry. A
-- table would let someone insert 'kk' and produce rows the application cannot
-- render. The enum also gives `Enums<"locale">` to the type generator, so the
-- UI derives its `Locale` union from the database (CLAUDE.md § 12).
create type public.locale as enum ('uz', 'ru', 'en');

comment on type public.locale is
  'Supported content languages. Adding one is a migration, not an insert: it also needs message files, a font subset and a routing entry.';

-- -----------------------------------------------------------------------------
-- Shared: the search configuration for a locale
-- -----------------------------------------------------------------------------
-- IMMUTABLE and inlined into generated columns. Uzbek has no Postgres
-- dictionary, so it falls back to 'simple' — no stemming, which is correct
-- rather than merely tolerable: it leaves "4090" and "RTX" intact.
create or replace function public.text_search_config(loc public.locale)
returns regconfig
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case loc
    when 'ru' then 'russian'::regconfig
    when 'en' then 'english'::regconfig
    else 'simple'::regconfig
  end;
$$;

comment on function public.text_search_config(public.locale) is
  'Dictionary for a locale. IMMUTABLE so it can be used in a generated tsvector column.';

-- =============================================================================
-- product_translations
-- =============================================================================
create table public.product_translations (
  product_id uuid not null references public.products (id) on delete cascade,
  locale public.locale not null,

  name text not null,
  short_description text,
  description text,

  -- Localized slug. A Russian shopper's URL should read as Russian, and this
  -- is the column that makes `/ru/products/videokarta-rtx-4090` possible.
  -- Routing adopts it when the storefront is wired; until then it is populated
  -- and unused, which is why it is nullable.
  slug text,

  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',

  -- Per-locale, which is the whole point. The weighting matches what the old
  -- single-language column did: name outranks prose. `seo_keywords` are folded
  -- in with `array_to_tsvector`, the only IMMUTABLE way to flatten a text[].
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(array_to_tsvector(seo_keywords), 'B') ||
    setweight(
      to_tsvector(public.text_search_config(locale), coalesce(short_description, '')),
      'C'
    ) ||
    setweight(
      to_tsvector(public.text_search_config(locale), coalesce(description, '')),
      'D'
    )
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (product_id, locale),

  constraint product_translations_name_length check (char_length(name) between 1 and 300),
  constraint product_translations_slug_valid check (slug is null or public.is_valid_slug(slug)),
  constraint product_translations_seo_title_length check (
    seo_title is null or char_length(seo_title) <= 120
  ),
  constraint product_translations_seo_description_length check (
    seo_description is null or char_length(seo_description) <= 320
  ),
  constraint product_translations_keywords_no_nulls check (
    array_position(seo_keywords, null) is null
  )
);

comment on table public.product_translations is
  'Per-locale product copy. One row per (product, locale); the parent holds only language-independent facts.';

-- A slug must be unique *within* a locale, not globally: "monitor" may be the
-- Uzbek slug of one product and the English slug of another.
create unique index idx_product_translations_slug
  on public.product_translations (locale, slug)
  where slug is not null;

-- The search index, per locale. A GIN index over the whole table works because
-- every query filters `locale = $1` first, which the planner uses.
create index idx_product_translations_search
  on public.product_translations using gin (search_vector);

-- "Every translation of this locale" — used by the admin's completeness view.
create index idx_product_translations_locale
  on public.product_translations (locale);

-- =============================================================================
-- category_translations
-- =============================================================================
create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale public.locale not null,

  name text not null,
  description text,
  slug text,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (category_id, locale),

  constraint category_translations_name_length check (char_length(name) between 1 and 200),
  constraint category_translations_slug_valid check (slug is null or public.is_valid_slug(slug)),
  constraint category_translations_keywords_no_nulls check (
    array_position(seo_keywords, null) is null
  )
);

comment on table public.category_translations is
  'Per-locale category copy. The tree structure stays on public.categories.';

create unique index idx_category_translations_slug
  on public.category_translations (locale, slug)
  where slug is not null;

create index idx_category_translations_locale
  on public.category_translations (locale);

-- =============================================================================
-- brand_translations
-- =============================================================================
-- `name` is deliberately **not** here: a brand name is a trademark and reads
-- identically in every language — transliterating "NVIDIA" into Cyrillic makes
-- it unsearchable and is not what the manufacturer's own Russian site does. It
-- stays on `public.brands`. Only the prose Bondo writes is translated.
create table public.brand_translations (
  brand_id uuid not null references public.brands (id) on delete cascade,
  locale public.locale not null,

  description text,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (brand_id, locale),

  constraint brand_translations_keywords_no_nulls check (
    array_position(seo_keywords, null) is null
  )
);

comment on table public.brand_translations is
  'Per-locale brand copy. The brand name is a trademark and stays on public.brands.';

create index idx_brand_translations_locale
  on public.brand_translations (locale);

-- =============================================================================
-- banner_translations
-- =============================================================================
create table public.banner_translations (
  banner_id uuid not null references public.site_banners (id) on delete cascade,
  locale public.locale not null,

  title text not null,
  subtitle text,
  -- The call-to-action label. The href stays on the banner: a link target is
  -- not copy, and `<Link>` adds the locale prefix.
  cta_label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (banner_id, locale),

  constraint banner_translations_title_length check (char_length(title) between 1 and 200)
);

comment on table public.banner_translations is
  'Per-locale banner copy. Scheduling and placement stay on public.site_banners.';

create index idx_banner_translations_locale
  on public.banner_translations (locale);

-- =============================================================================
-- content_pages + content_page_translations
-- =============================================================================
-- New. The footer already lists About, Contact, Warranty, Delivery, Returns,
-- FAQ, Privacy and Terms as plain text because the pages do not exist; the
-- admin has an editor for them backed by fixtures. This is the table behind it.
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),

  -- The stable identifier the route uses. Localized slugs live on the
  -- translation row; this one is the key the application branches on.
  key text not null unique,

  is_published boolean not null default false,
  published_at timestamptz,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint content_pages_key_valid check (public.is_valid_slug(key)),
  constraint content_pages_published_requires_date check (
    not is_published or published_at is not null
  )
);

comment on table public.content_pages is
  'Static pages (about, warranty, privacy…). Copy lives in content_page_translations.';

create index idx_content_pages_published
  on public.content_pages (display_order)
  where deleted_at is null and is_published;

create table public.content_page_translations (
  page_id uuid not null references public.content_pages (id) on delete cascade,
  locale public.locale not null,

  title text not null,
  excerpt text,
  body text,
  slug text,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',

  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(
      to_tsvector(public.text_search_config(locale), coalesce(excerpt, '')),
      'B'
    ) ||
    setweight(
      to_tsvector(public.text_search_config(locale), coalesce(body, '')),
      'C'
    )
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (page_id, locale),

  constraint content_page_translations_title_length check (
    char_length(title) between 1 and 200
  ),
  constraint content_page_translations_slug_valid check (
    slug is null or public.is_valid_slug(slug)
  ),
  constraint content_page_translations_keywords_no_nulls check (
    array_position(seo_keywords, null) is null
  )
);

comment on table public.content_page_translations is
  'Per-locale static page copy.';

create unique index idx_content_page_translations_slug
  on public.content_page_translations (locale, slug)
  where slug is not null;

create index idx_content_page_translations_search
  on public.content_page_translations using gin (search_vector);

create index idx_content_page_translations_locale
  on public.content_page_translations (locale);

-- =============================================================================
-- setting_translations
-- =============================================================================
-- "Where appropriate" is the operative phrase: most settings are configuration
-- — a currency code, a tax rate, an email address — and translating them is
-- nonsense. Only settings a customer reads as prose need this, so localization
-- is opt-in per key via `settings.is_localized` rather than assumed.
alter table public.settings
  add column is_localized boolean not null default false;

comment on column public.settings.is_localized is
  'Whether this setting has rows in setting_translations. False for configuration (currency, tax rate); true for customer-facing prose (tagline, address).';

create table public.setting_translations (
  setting_key text not null references public.settings (key) on delete cascade,
  locale public.locale not null,

  value text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  primary key (setting_key, locale)
);

comment on table public.setting_translations is
  'Per-locale value for settings flagged is_localized. Text, not jsonb: a localized setting is prose.';

create index idx_setting_translations_locale
  on public.setting_translations (locale);

-- =============================================================================
-- Migrate existing content into the `en` translation
-- =============================================================================
-- The seeded content is English. Moving it before dropping the columns means
-- no data is lost and no deployment observes both shapes.
insert into public.product_translations (
  product_id, locale, name, short_description, description,
  slug, seo_title, seo_description, seo_keywords
)
select
  id, 'en', name, short_description, description,
  slug, seo_title, seo_description, search_keywords
from public.products;

insert into public.category_translations (
  category_id, locale, name, description, slug, seo_title, seo_description
)
select id, 'en', name, description, slug, seo_title, seo_description
from public.categories;

insert into public.brand_translations (
  brand_id, locale, description, seo_title, seo_description
)
select id, 'en', description, seo_title, seo_description
from public.brands;

insert into public.banner_translations (banner_id, locale, title, subtitle)
select id, 'en', title, subtitle
from public.site_banners;

-- =============================================================================
-- Drop the single-language columns
-- =============================================================================
-- The duplicate concept goes. Two places to write a product name is exactly
-- what K-15/K-16 were.
--
-- `search_vector` and its index go with them: the replacement is per-locale and
-- lives on the translation row. `products.slug` goes too — the canonical URL is
-- now the localized slug, and keeping a second one would leave the application
-- choosing between them.
drop index if exists public.idx_products_search_vector;

alter table public.products
  drop column search_vector,
  drop column name,
  drop column short_description,
  drop column description,
  drop column slug,
  drop column seo_title,
  drop column seo_description,
  drop column search_keywords;

alter table public.categories
  drop column name,
  drop column description,
  drop column slug,
  drop column seo_title,
  drop column seo_description;

alter table public.brands
  drop column description,
  drop column seo_title,
  drop column seo_description;

alter table public.site_banners
  drop column title,
  drop column subtitle;

-- =============================================================================
-- updated_at
-- =============================================================================
create trigger product_translations_set_updated_at
  before update on public.product_translations
  for each row execute function public.set_updated_at();

create trigger category_translations_set_updated_at
  before update on public.category_translations
  for each row execute function public.set_updated_at();

create trigger brand_translations_set_updated_at
  before update on public.brand_translations
  for each row execute function public.set_updated_at();

create trigger banner_translations_set_updated_at
  before update on public.banner_translations
  for each row execute function public.set_updated_at();

create trigger content_pages_set_updated_at
  before update on public.content_pages
  for each row execute function public.set_updated_at();

create trigger content_page_translations_set_updated_at
  before update on public.content_page_translations
  for each row execute function public.set_updated_at();

create trigger setting_translations_set_updated_at
  before update on public.setting_translations
  for each row execute function public.set_updated_at();

-- Attribution, matching the parent tables.
create trigger product_translations_set_actor
  before insert or update on public.product_translations
  for each row execute function public.set_row_actor();

create trigger category_translations_set_actor
  before insert or update on public.category_translations
  for each row execute function public.set_row_actor();

create trigger brand_translations_set_actor
  before insert or update on public.brand_translations
  for each row execute function public.set_row_actor();

create trigger banner_translations_set_actor
  before insert or update on public.banner_translations
  for each row execute function public.set_row_actor();

create trigger content_pages_set_actor
  before insert or update on public.content_pages
  for each row execute function public.set_row_actor();

create trigger content_page_translations_set_actor
  before insert or update on public.content_page_translations
  for each row execute function public.set_row_actor();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Every translation table mirrors its parent's policies. A translation is not
-- less sensitive than the row it describes: if a draft product is invisible to
-- anonymous, so is its name.
alter table public.product_translations enable row level security;
alter table public.category_translations enable row level security;
alter table public.brand_translations enable row level security;
alter table public.banner_translations enable row level security;
alter table public.content_pages enable row level security;
alter table public.content_page_translations enable row level security;
alter table public.setting_translations enable row level security;

-- Products ---------------------------------------------------------------
create policy "product_translations: anon reads published"
on public.product_translations for select
to anon, authenticated
using (public.is_product_published(product_id));

create policy "product_translations: readers with products.read"
on public.product_translations for select
to authenticated
using (public.has_permission('products.read'));

create policy "product_translations: writers with products.update"
on public.product_translations for all
to authenticated
using (public.has_permission('products.update'))
with check (public.has_permission('products.update'));

-- Categories -------------------------------------------------------------
create policy "category_translations: anon reads visible"
on public.category_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.categories c
    where c.id = category_id and c.is_visible and c.deleted_at is null
  )
);

create policy "category_translations: managers write"
on public.category_translations for all
to authenticated
using (public.has_permission('categories.manage'))
with check (public.has_permission('categories.manage'));

-- Brands -----------------------------------------------------------------
create policy "brand_translations: anon reads visible"
on public.brand_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.brands b
    where b.id = brand_id and b.is_visible and b.deleted_at is null
  )
);

create policy "brand_translations: managers write"
on public.brand_translations for all
to authenticated
using (public.has_permission('brands.manage'))
with check (public.has_permission('brands.manage'));

-- Banners ----------------------------------------------------------------
create policy "banner_translations: anon reads live"
on public.banner_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.site_banners b
    where b.id = banner_id
      and b.is_active
      and b.deleted_at is null
      and (b.starts_at is null or b.starts_at <= now())
      and (b.ends_at is null or b.ends_at >= now())
  )
);

create policy "banner_translations: readers with banners.read"
on public.banner_translations for select
to authenticated
using (public.has_permission('banners.read'));

create policy "banner_translations: managers write"
on public.banner_translations for all
to authenticated
using (public.has_permission('banners.manage'))
with check (public.has_permission('banners.manage'));

-- Content pages ----------------------------------------------------------
create policy "content_pages: anon reads published"
on public.content_pages for select
to anon, authenticated
using (is_published and deleted_at is null);

create policy "content_pages: readers with banners.read"
on public.content_pages for select
to authenticated
using (public.has_permission('banners.read'));

create policy "content_pages: managers write"
on public.content_pages for all
to authenticated
using (public.has_permission('banners.manage'))
with check (public.has_permission('banners.manage'));

create policy "content_page_translations: anon reads published"
on public.content_page_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.content_pages p
    where p.id = page_id and p.is_published and p.deleted_at is null
  )
);

create policy "content_page_translations: readers with banners.read"
on public.content_page_translations for select
to authenticated
using (public.has_permission('banners.read'));

create policy "content_page_translations: managers write"
on public.content_page_translations for all
to authenticated
using (public.has_permission('banners.manage'))
with check (public.has_permission('banners.manage'));

-- Settings ---------------------------------------------------------------
create policy "setting_translations: anon reads public settings"
on public.setting_translations for select
to anon, authenticated
using (
  exists (
    select 1 from public.settings s
    where s.key = setting_key and s.is_public
  )
);

create policy "setting_translations: readers with settings.read"
on public.setting_translations for select
to authenticated
using (public.has_permission('settings.read'));

create policy "setting_translations: writers with settings.update"
on public.setting_translations for all
to authenticated
using (public.has_permission('settings.update'))
with check (public.has_permission('settings.update'));

-- =============================================================================
-- Grants
-- =============================================================================
-- Explicit, matching migration 000900: a privilege model that exists only as a
-- platform default is one nobody can review.
grant select on public.product_translations to anon, authenticated;
grant select on public.category_translations to anon, authenticated;
grant select on public.brand_translations to anon, authenticated;
grant select on public.banner_translations to anon, authenticated;
grant select on public.content_pages to anon, authenticated;
grant select on public.content_page_translations to anon, authenticated;
grant select on public.setting_translations to anon, authenticated;

grant insert, update, delete on public.product_translations to authenticated;
grant insert, update, delete on public.category_translations to authenticated;
grant insert, update, delete on public.brand_translations to authenticated;
grant insert, update, delete on public.banner_translations to authenticated;
grant insert, update, delete on public.content_pages to authenticated;
grant insert, update, delete on public.content_page_translations to authenticated;
grant insert, update, delete on public.setting_translations to authenticated;
