-- =============================================================================
-- Settings and site banners
-- =============================================================================

-- -----------------------------------------------------------------------------
-- settings
-- -----------------------------------------------------------------------------
-- Key/value rather than a one-row table with a column per setting: adding a
-- setting must not require a migration and a type regeneration, because the
-- people who add settings are merchandisers, not engineers.
--
-- The cost of that flexibility is that values are untyped to Postgres. jsonb
-- rather than text keeps structure available, and the application validates the
-- shape at the edge with Zod, which is where the project already does its
-- runtime validation.
create table public.settings (
  key text primary key,
  value jsonb not null,
  description text,

  -- The security boundary of this table. `true` means anonymous visitors may
  -- read it — store hours, support email. Anything with a secret in it stays
  -- false and is only ever read server-side.
  is_public boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,

  constraint settings_key_format check (key ~ '^[a-z][a-z0-9_.]*[a-z0-9]$'),
  constraint settings_key_length check (char_length(key) between 2 and 120)
);

comment on table public.settings is
  'Runtime configuration as key/jsonb. `is_public` decides anonymous readability — default false, so a new setting is private until someone says otherwise.';
comment on column public.settings.is_public is
  'Anonymous read flag. Never set true for anything a competitor or attacker should not see.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- The storefront reads the whole public set on nearly every render. A partial
-- index keeps that scan proportional to the public subset rather than the table.
create index idx_settings_public on public.settings (key) where is_public;

-- -----------------------------------------------------------------------------
-- site_banners
-- -----------------------------------------------------------------------------
create type public.banner_placement as enum (
  'home_hero',
  'home_secondary',
  'category_top',
  'site_wide_notice'
);

comment on type public.banner_placement is
  'Where a banner renders. An enum rather than free text because the storefront must have a component for each placement — an unknown value would render nothing.';

create table public.site_banners (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  subtitle text,
  image_path text,
  link_url text,
  placement public.banner_placement not null,

  display_order integer not null default 0,
  is_active boolean not null default false,

  -- Scheduling window. Both nullable: NULL start means "already live", NULL end
  -- means "until switched off". Evaluated in the read policy, so a scheduled
  -- banner appears and disappears on time with no cron job.
  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint site_banners_title_length check (char_length(title) between 1 and 200),
  constraint site_banners_window_ordered check (
    starts_at is null or ends_at is null or starts_at < ends_at
  ),
  -- A banner is a call to action; one with a link to nowhere is a dead end, and
  -- a relative link keeps it inside the site.
  constraint site_banners_link_url_shape check (
    link_url is null or link_url ~ '^(/|https?://)'
  )
);

comment on table public.site_banners is
  'Merchandising banners with an optional scheduling window. Live-ness is computed in the read policy, not by a job.';

create trigger site_banners_set_updated_at
  before update on public.site_banners
  for each row execute function public.set_updated_at();
create trigger site_banners_set_row_actor
  before insert or update on public.site_banners
  for each row execute function public.set_row_actor();

-- The storefront query: live banners for one placement, in order. The predicate
-- covers only the always-true parts; the time window is left to the policy
-- because now() is not immutable and cannot appear in an index predicate.
create index idx_site_banners_live
  on public.site_banners (placement, display_order)
  where deleted_at is null and is_active;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.settings enable row level security;
alter table public.site_banners enable row level security;

create policy "settings: public reads public settings"
  on public.settings for select
  to anon, authenticated
  using (is_public);

create policy "settings: settings.read sees all"
  on public.settings for select
  to authenticated
  using (public.has_permission('settings.read'));

create policy "settings: settings.update writes"
  on public.settings for all
  to authenticated
  using (public.has_permission('settings.update'))
  with check (public.has_permission('settings.update'));

create policy "site_banners: public reads live banners"
  on public.site_banners for select
  to anon, authenticated
  using (
    deleted_at is null
    and is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

create policy "site_banners: banners.read sees all"
  on public.site_banners for select
  to authenticated
  using (public.has_permission('banners.read'));

create policy "site_banners: banners.manage writes"
  on public.site_banners for all
  to authenticated
  using (public.has_permission('banners.manage'))
  with check (public.has_permission('banners.manage'));

-- =============================================================================
-- Baseline settings
-- =============================================================================
-- Structural, not content: these keys are read by application code, so their
-- absence is a missing feature rather than an empty list. Values are
-- deliberately conservative and are meant to be edited in the admin console.
insert into public.settings (key, value, description, is_public) values
  ('store.name',                 '"Bondo"'::jsonb,  'Display name used in transactional email and invoices.', true),
  ('store.currency',             '"USD"'::jsonb,    'ISO 4217 code. All prices are integer minor units of this currency.', true),
  ('store.support_email',        'null'::jsonb,     'Public support address. Null until configured.', true),
  ('catalog.products_per_page',  '24'::jsonb,       'Default page size for catalog listings.', true),
  ('catalog.max_products_per_page', '96'::jsonb,    'Upper bound the API will honour, to stop a crafted page-size parameter scanning the catalog.', false),
  ('orders.low_stock_email',     'null'::jsonb,     'Address that receives low-stock notifications. Null disables them.', false);
