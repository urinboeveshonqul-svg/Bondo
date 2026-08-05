-- =============================================================================
-- Product variants — closes D-8
-- =============================================================================
-- A product has sold as exactly one purchasable thing since Phase 2: one SKU,
-- one price, one stock level. A laptop offered in 16GB and 32GB therefore needed
-- two product rows, with two descriptions, two image sets and two SEO records to
-- keep in step. The admin has had a variant editor since Phase 3A with no table
-- under it (**D-8**), which is the gap this closes.
--
-- The shape is the one Shopify, Saleor and Medusa converged on, and it is worth
-- saying why rather than citing them:
--
--   options → values → variants → the values each variant holds
--
-- Four tables rather than a `jsonb` blob of `{ ram: "32GB" }`, for the reasons
-- already recorded in ADR-51: a blob cannot be constrained (a variant must hold
-- exactly one value per axis), cannot be indexed usefully, and cannot have a
-- foreign key — so a value renamed on the axis silently orphans every variant
-- that used it.
--
-- -----------------------------------------------------------------------------
-- Stock lives in one place, and it is still `inventory`
-- -----------------------------------------------------------------------------
-- The tempting shortcut is `product_variants.stock_on_hand`. It is wrong for the
-- reason ADR-24 already gives: two writable copies of a quantity are two
-- quantities, and the ledger stops explaining the number. So `inventory` and
-- `inventory_movements` gain a nullable `variant_id` instead, and the existing
-- append-only guard keeps working on both.
--
--   variant_id IS NULL      → the product's own stock, exactly as before
--   variant_id IS NOT NULL  → that configuration's stock
--
-- A product either has variants or it does not, so those two never disagree in
-- practice; the schema allows both because a product gains variants *after* it
-- has stock, and a migration that forces the choice at creation time would make
-- that a destructive edit.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- product_options — the axes
-- -----------------------------------------------------------------------------
create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  -- The machine name the application groups by: cpu, gpu, ram, storage, colour,
  -- size, configuration. Free text rather than an enum: the axes a computer
  -- shop needs are not the axes a clothing shop needs, and an enum would make
  -- "add a Socket axis" a migration.
  key text not null,
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  constraint product_options_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint product_options_position_non_negative check (position >= 0),
  -- One axis per key per product. "RAM" twice is a data-entry mistake that
  -- produces a combination matrix nobody can reason about.
  unique (product_id, key)
);

comment on table public.product_options is
  'A variant axis on one product — RAM, storage, colour. Its display name is localized in product_option_translations.';

create index idx_product_options_product_id
  on public.product_options (product_id, position);

-- The axis's display name, per language. "Memory" / "Xotira" / "Память" is
-- interface-adjacent copy that a merchandiser writes per product, so it lives on
-- the record rather than in `messages/` (ADR-39).
create table public.product_option_translations (
  option_id uuid not null references public.product_options (id) on delete cascade,
  locale public.locale not null,

  name text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (option_id, locale),
  constraint product_option_translations_name_length check (
    char_length(name) between 1 and 120
  )
);

comment on table public.product_option_translations is
  'Localized display name for a variant axis, keyed (option, locale) like every other translation table (ADR-51).';

-- -----------------------------------------------------------------------------
-- product_option_values — what an axis may be set to
-- -----------------------------------------------------------------------------
create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options (id) on delete cascade,

  -- Deliberately **not** localized. These are specifications — "32GB", "RTX
  -- 5080", "1TB NVMe" — and they read identically in all three languages.
  -- Translating them would invite "32ГБ", which is unsearchable and wrong on a
  -- spec sheet. A colour axis is the arguable exception and is handled the same
  -- way for now; see D-27.
  value text not null,
  position integer not null default 0,

  created_at timestamptz not null default now(),

  constraint product_option_values_value_length check (
    char_length(value) between 1 and 120
  ),
  constraint product_option_values_position_non_negative check (position >= 0),
  unique (option_id, value)
);

comment on table public.product_option_values is
  'An allowed value on one axis. Not localized: "32GB" is a specification, not copy.';

create index idx_product_option_values_option_id
  on public.product_option_values (option_id, position);

-- -----------------------------------------------------------------------------
-- product_variants — the purchasable configurations
-- -----------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  -- Unique across the catalog, like `products.sku`, and for the same reason: a
  -- SKU is what a warehouse scans, and two things sharing one is a picking
  -- error. Partial so a soft-deleted variant releases its SKU.
  sku text not null,
  barcode text,

  -- Integer minor units throughout (ADR-2). `null` sale price means "not on
  -- sale" rather than "zero", which is the distinction a nullable column exists
  -- to carry.
  price_cents integer not null,
  sale_price_cents integer,
  cost_price_cents integer,

  weight_grams integer,
  position integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint product_variants_sku_length check (char_length(sku) between 1 and 64),
  constraint product_variants_barcode_length check (
    barcode is null or char_length(barcode) between 6 and 64
  ),
  constraint product_variants_price_non_negative check (price_cents >= 0),
  constraint product_variants_sale_price_valid check (
    sale_price_cents is null
    or (sale_price_cents >= 0 and sale_price_cents <= price_cents)
  ),
  constraint product_variants_cost_price_non_negative check (
    cost_price_cents is null or cost_price_cents >= 0
  ),
  constraint product_variants_weight_positive check (
    weight_grams is null or weight_grams > 0
  ),
  constraint product_variants_position_non_negative check (position >= 0)
);

comment on table public.product_variants is
  'A purchasable configuration of a product. Stock lives in inventory keyed by variant_id, never here (ADR-24).';

create unique index idx_product_variants_sku
  on public.product_variants (sku)
  where deleted_at is null;

create index idx_product_variants_product_id
  on public.product_variants (product_id, position)
  where deleted_at is null;

-- A sale price beating the product's own is the common merchandising case, so
-- nothing cross-checks the two: the variant price is authoritative once a
-- variant exists.

-- -----------------------------------------------------------------------------
-- product_variant_options — which value each variant holds on each axis
-- -----------------------------------------------------------------------------
create table public.product_variant_options (
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  option_id uuid not null references public.product_options (id) on delete cascade,
  value_id uuid not null references public.product_option_values (id) on delete cascade,

  -- One value per axis per variant. Without this a variant could claim both
  -- 16GB and 32GB, and the matrix that generated it would be unrepresentable.
  primary key (variant_id, option_id)
);

comment on table public.product_variant_options is
  'The value a variant holds on one axis. The composite key is what stops a variant claiming two values on the same axis.';

create index idx_product_variant_options_value_id
  on public.product_variant_options (value_id);

-- -----------------------------------------------------------------------------
-- Variant images
-- -----------------------------------------------------------------------------
-- A colour axis needs a photograph per colour. `product_images` gains a nullable
-- variant_id rather than a second image table: one uploader, one storage bucket,
-- one ordering rule (the brief's "no duplicated components", applied to the
-- schema).
--
--   variant_id IS NULL      → a gallery image for the product
--   variant_id IS NOT NULL  → shown when that configuration is selected
alter table public.product_images
  add column variant_id uuid references public.product_variants (id) on delete cascade;

create index idx_product_images_variant_id
  on public.product_images (variant_id)
  where variant_id is not null;

comment on column public.product_images.variant_id is
  'Null for a product gallery image; set when the image belongs to one configuration.';

-- =============================================================================
-- Inventory at the variant level
-- =============================================================================
-- `inventory` was keyed by product_id alone. It gains a surrogate key and a
-- nullable variant_id so the same table, the same ledger and the same
-- append-only guard serve both levels.

alter table public.inventory
  add column id uuid not null default gen_random_uuid(),
  add column variant_id uuid references public.product_variants (id) on delete cascade;

alter table public.inventory drop constraint inventory_pkey;
alter table public.inventory add primary key (id);

-- Two partial uniques rather than one composite: NULLs are distinct in a unique
-- index, so `unique (product_id, variant_id)` would happily allow a product two
-- product-level rows.
create unique index idx_inventory_product_level
  on public.inventory (product_id)
  where variant_id is null;

create unique index idx_inventory_variant_level
  on public.inventory (product_id, variant_id)
  where variant_id is not null;

alter table public.inventory_movements
  add column variant_id uuid references public.product_variants (id) on delete cascade;

create index idx_inventory_movements_variant_id
  on public.inventory_movements (variant_id, created_at desc)
  where variant_id is not null;

-- -----------------------------------------------------------------------------
-- The ledger now applies to the right row
-- -----------------------------------------------------------------------------
-- `is not distinct from` rather than `=`: a product-level movement carries a
-- NULL variant_id, and `null = null` is null, which would match nothing and
-- silently create a second inventory row on every movement.
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_quantity integer;
begin
  -- Lock the inventory row for the rest of the transaction. Two concurrent
  -- movements on one product would otherwise interleave read-modify-write and
  -- lose an update; this serialises them.
  perform 1
  from public.inventory
  where product_id = new.product_id
    and variant_id is not distinct from new.variant_id
  for update;

  if not found then
    insert into public.inventory (product_id, variant_id)
    values (new.product_id, new.variant_id)
    on conflict do nothing;
  end if;

  perform set_config('app.inventory_movement', 'on', true);

  update public.inventory
  set quantity_on_hand = quantity_on_hand + new.quantity_delta
  where product_id = new.product_id
    and variant_id is not distinct from new.variant_id
  returning quantity_on_hand into new_quantity;

  perform set_config('app.inventory_movement', '', true);

  -- Authoritative regardless of what the caller supplied.
  new.quantity_after := new_quantity;
  return new;
end;
$$;

comment on function public.apply_inventory_movement() is
  'BEFORE INSERT on inventory_movements: applies the delta to the matching product- or variant-level inventory row under a row lock, and stamps quantity_after.';

-- The product-level creator has to be updated too: it targeted `on conflict
-- (product_id)`, which resolved to the primary key that no longer exists. It now
-- names the partial unique index instead, which is the only thing that means
-- "the product's own inventory row". Caught by the seed failing to apply, which
-- is exactly what running the seed in `db:verify` is for.
create or replace function public.create_inventory_for_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id)
  values (new.id)
  on conflict (product_id) where variant_id is null do nothing;
  return new;
end;
$$;

comment on function public.create_inventory_for_product() is
  'AFTER INSERT on products: guarantees every product has a product-level inventory row from birth.';

-- Every variant needs an inventory row from birth, for the same reason every
-- product does: otherwise "in stock?" becomes a NULL check at every call site.
create or replace function public.create_inventory_for_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id, variant_id)
  values (new.product_id, new.id)
  on conflict do nothing;
  return new;
end;
$$;

comment on function public.create_inventory_for_variant() is
  'AFTER INSERT on product_variants: guarantees every variant has an inventory row from birth.';

create trigger product_variants_create_inventory
  after insert on public.product_variants
  for each row execute function public.create_inventory_for_variant();

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
create trigger product_options_set_updated_at
  before update on public.product_options
  for each row execute function public.set_updated_at();

create trigger product_option_translations_set_updated_at
  before update on public.product_option_translations
  for each row execute function public.set_updated_at();

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

create trigger product_variants_set_row_actor
  before insert or update on public.product_variants
  for each row execute function public.set_row_actor();

create trigger product_options_set_row_actor
  before insert or update on public.product_options
  for each row execute function public.set_row_actor();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Mirrors the parent product's policies exactly: anonymous visitors read the
-- variants of a product they can already see, and staff manage them with the
-- same permissions that govern the product itself. A variant readable when its
-- product is not would leak an unreleased configuration.

alter table public.product_options enable row level security;
alter table public.product_option_translations enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_variant_options enable row level security;

create policy "product_options: public reads options of published products"
  on public.product_options for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_options.product_id
        and p.deleted_at is null
        and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null
        and p.published_at <= now()
    )
  );

create policy "product_options: products.read sees everything"
  on public.product_options for select
  to authenticated
  using (public.has_permission('products.read'));

create policy "product_options: products.update manages"
  on public.product_options for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "product_option_translations: readable with the option"
  on public.product_option_translations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.product_options o
      where o.id = product_option_translations.option_id
    )
  );

create policy "product_option_translations: products.update manages"
  on public.product_option_translations for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "product_option_values: readable with the option"
  on public.product_option_values for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.product_options o
      where o.id = product_option_values.option_id
    )
  );

create policy "product_option_values: products.update manages"
  on public.product_option_values for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "product_variants: public reads active variants of published products"
  on public.product_variants for select
  to anon, authenticated
  using (
    deleted_at is null
    and is_active
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id
        and p.deleted_at is null
        and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null
        and p.published_at <= now()
    )
  );

create policy "product_variants: products.read sees everything"
  on public.product_variants for select
  to authenticated
  using (public.has_permission('products.read'));

create policy "product_variants: products.update manages"
  on public.product_variants for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "product_variant_options: readable with the variant"
  on public.product_variant_options for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.product_variants v
      where v.id = product_variant_options.variant_id
    )
  );

create policy "product_variant_options: products.update manages"
  on public.product_variant_options for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

-- =============================================================================
-- Grants
-- =============================================================================
-- Explicit, matching 20260801000900: `anon` reads and nothing else, so a
-- mistaken policy still meets a closed second gate (ADR-30).
grant select on public.product_options to anon, authenticated;
grant select on public.product_option_translations to anon, authenticated;
grant select on public.product_option_values to anon, authenticated;
grant select on public.product_variants to anon, authenticated;
grant select on public.product_variant_options to anon, authenticated;

grant insert, update, delete on public.product_options to authenticated;
grant insert, update, delete on public.product_option_translations to authenticated;
grant insert, update, delete on public.product_option_values to authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant insert, update, delete on public.product_variant_options to authenticated;
