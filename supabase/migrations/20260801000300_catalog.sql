-- =============================================================================
-- Catalog: brands, categories, products, images, specifications
-- =============================================================================
-- Sizing targets this schema is built for: 50,000+ products, 500+ brands,
-- 500+ categories. The indexes at the foot of this file are chosen for the
-- access patterns those numbers imply, and each one carries the reason it
-- exists. An index nobody can justify is write amplification with extra steps.
-- =============================================================================

create type public.product_status as enum ('draft', 'active', 'archived');

comment on type public.product_status is
  'Editorial lifecycle. Only `active` products are sellable; `archived` keeps history without listing.';

create type public.product_visibility as enum ('public', 'hidden');

comment on type public.product_visibility is
  'Whether a product may appear to anonymous visitors. Orthogonal to status: an active product can be hidden while photography is redone.';

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,

  -- Storage object paths, not URLs — see the note on profiles.avatar_path.
  logo_path text,
  website_url text,

  is_featured boolean not null default false,
  is_visible boolean not null default true,

  seo_title text,
  seo_description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint brands_slug_valid check (public.is_valid_slug(slug)),
  constraint brands_name_length check (char_length(name) between 1 and 200),
  constraint brands_website_url_scheme check (
    website_url is null or website_url ~ '^https?://'
  ),
  constraint brands_seo_title_length check (
    seo_title is null or char_length(seo_title) <= 120
  ),
  constraint brands_seo_description_length check (
    seo_description is null or char_length(seo_description) <= 320
  )
);

comment on table public.brands is
  'Manufacturers. Soft-deleted because products reference them and history must survive a brand being dropped.';

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();
create trigger brands_set_row_actor
  before insert or update on public.brands
  for each row execute function public.set_row_actor();

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
-- Unlimited nesting depth. `parent_id` is the truth; `path` and `depth` are
-- derived by trigger and exist so that subtree queries ("everything under
-- Components") are a single indexed containment test rather than a recursive
-- CTE per request. A recursive CTE is correct but pays the recursion on every
-- page view; this pays it once per write, and writes are rare.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,

  slug text not null,
  name text not null,
  description text,
  image_path text,

  -- Root-to-self chain of ids, inclusive. Maintained by trigger; never written
  -- by the application.
  path uuid[] not null default '{}',
  depth integer not null default 0,

  display_order integer not null default 0,
  is_visible boolean not null default true,

  seo_title text,
  seo_description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint categories_slug_valid check (public.is_valid_slug(slug)),
  constraint categories_name_length check (char_length(name) between 1 and 200),
  constraint categories_depth_non_negative check (depth >= 0),
  constraint categories_not_self_parent check (parent_id is distinct from id),
  constraint categories_seo_title_length check (
    seo_title is null or char_length(seo_title) <= 120
  ),
  constraint categories_seo_description_length check (
    seo_description is null or char_length(seo_description) <= 320
  )
);

comment on table public.categories is
  'Nested category tree of unlimited depth. `path`/`depth` are trigger-maintained; edit `parent_id` only.';
comment on column public.categories.path is
  'Root-to-self uuid chain, inclusive. Query a subtree with: where path @> array[<ancestor_id>]::uuid[]';

-- ON DELETE RESTRICT above stops a delete that would orphan children. Soft
-- delete is the intended path for retiring a category, which this trigger does
-- not interfere with.
create or replace function public.categories_set_path()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_path uuid[];
begin
  if new.parent_id is null then
    new.path := array[new.id];
    new.depth := 0;
  else
    select c.path into parent_path
    from public.categories c
    where c.id = new.parent_id;

    if parent_path is null then
      raise exception 'parent category % does not exist', new.parent_id
        using errcode = 'foreign_key_violation';
    end if;

    -- Re-parenting a node under its own descendant would build a cycle, and a
    -- cycle in a category tree is an infinite loop in every breadcrumb.
    if new.id = any (parent_path) then
      raise exception 'category % cannot be moved under its own descendant', new.id
        using errcode = 'check_violation';
    end if;

    new.path := parent_path || new.id;
    new.depth := coalesce(array_length(new.path, 1), 1) - 1;
  end if;
  return new;
end;
$$;

comment on function public.categories_set_path() is
  'BEFORE INSERT OR UPDATE OF parent_id: recomputes path/depth and rejects cycles.';

create trigger categories_set_path
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_set_path();

-- Moving a branch has to rewrite the path of everything beneath it, or the
-- subtree index silently goes stale and queries start returning wrong answers.
-- AFTER UPDATE so the parent's own path is already final.
create or replace function public.categories_rebuild_descendants()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.path is distinct from old.path then
    update public.categories c
    set path = new.path || c.path[(array_length(old.path, 1) + 1):],
        depth = coalesce(array_length(new.path || c.path[(array_length(old.path, 1) + 1):], 1), 1) - 1
    where c.path @> old.path
      and c.id <> new.id;
  end if;
  return null;
end;
$$;

comment on function public.categories_rebuild_descendants() is
  'AFTER UPDATE: rewrites descendant paths when a branch is re-parented.';

create trigger categories_rebuild_descendants
  after update of parent_id on public.categories
  for each row execute function public.categories_rebuild_descendants();

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),

  sku text not null,
  slug text not null,
  name text not null,
  short_description text,
  description text,

  -- RESTRICT, not CASCADE: deleting a brand must never silently delete the
  -- products carrying it. Retire brands by soft-deleting them.
  brand_id uuid references public.brands (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,

  status public.product_status not null default 'draft',
  visibility public.product_visibility not null default 'public',
  is_featured boolean not null default false,

  -- All money is integer minor units (ADR-2). `price_cents` is the list price;
  -- `sale_price_cents` is the promotional price when one is running, and must
  -- be below list or it is not a sale. `cost_price_cents` is what Bondo paid
  -- and is never exposed to a customer — no RLS policy selects it for anon,
  -- because anon cannot select the row at all unless published.
  price_cents integer not null,
  sale_price_cents integer,
  cost_price_cents integer,

  weight_grams integer,
  length_mm integer,
  width_mm integer,
  height_mm integer,
  warranty_months integer,

  seo_title text,
  seo_description text,
  search_keywords text[] not null default '{}',

  -- Weighted so a SKU or name match outranks a description match. Generated
  -- rather than trigger-maintained because Postgres then guarantees it can
  -- never drift from its inputs.
  --
  -- Every function here must be IMMUTABLE. `to_tsvector` is only immutable in
  -- its two-argument form with an explicit regconfig, and `array_to_string` is
  -- STABLE — using it here fails with "generation expression is not immutable".
  -- `array_to_tsvector` is the immutable way to fold a text[] in.
  --
  -- 'simple' for name/SKU/keywords: no stemming, so "4090" and "RTX" survive
  -- intact. 'english' for prose, where stemming is what the shopper wants.
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(sku, '')), 'A') ||
    setweight(array_to_tsvector(search_keywords), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(short_description, '')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'D')
  ) stored,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint products_sku_format check (sku ~ '^[A-Z0-9][A-Z0-9._-]{1,63}$'),
  constraint products_slug_valid check (public.is_valid_slug(slug)),
  constraint products_name_length check (char_length(name) between 1 and 300),
  constraint products_price_non_negative check (price_cents >= 0),
  constraint products_sale_price_valid check (
    sale_price_cents is null
    or (sale_price_cents >= 0 and sale_price_cents < price_cents)
  ),
  constraint products_cost_price_non_negative check (
    cost_price_cents is null or cost_price_cents >= 0
  ),
  constraint products_weight_non_negative check (
    weight_grams is null or weight_grams >= 0
  ),
  constraint products_dimensions_non_negative check (
    (length_mm is null or length_mm >= 0)
    and (width_mm is null or width_mm >= 0)
    and (height_mm is null or height_mm >= 0)
  ),
  constraint products_warranty_non_negative check (
    warranty_months is null or warranty_months >= 0
  ),
  constraint products_seo_title_length check (
    seo_title is null or char_length(seo_title) <= 120
  ),
  constraint products_seo_description_length check (
    seo_description is null or char_length(seo_description) <= 320
  ),
  -- array_to_tsvector() throws on a NULL element, which would turn a bad write
  -- into a confusing runtime error inside the generated column. Reject it at
  -- the constraint instead, where the message names the column.
  constraint products_keywords_no_nulls check (array_position(search_keywords, null) is null),
  -- An active product that nothing has ever published is a contradiction the
  -- storefront query would have to special-case. Refuse it here instead.
  constraint products_active_requires_published_at check (
    status <> 'active' or published_at is not null
  )
);

comment on table public.products is
  'Sellable items. Stock is NOT here — public.inventory owns quantity so there is exactly one source of truth (ADR-24).';
comment on column public.products.price_cents is
  'List price in integer minor units of the store currency (ADR-2).';
comment on column public.products.cost_price_cents is
  'Purchase cost. Internal only — never selected by an anonymous-readable policy.';
comment on column public.products.search_vector is
  'Generated weighted tsvector. A=name/SKU, B=keywords, C=short description, D=description.';

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
create trigger products_set_row_actor
  before insert or update on public.products
  for each row execute function public.set_row_actor();

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  -- CASCADE here, unlike brand/category: an image has no meaning without its
  -- product, and orphaned storage rows are a slow leak.
  product_id uuid not null references public.products (id) on delete cascade,

  storage_path text not null,
  alt_text text,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  width integer,
  height integer,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint product_images_storage_path_length check (char_length(storage_path) between 1 and 1024),
  constraint product_images_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  )
);

comment on table public.product_images is
  'Unlimited images per product. `storage_path` is a key in the `products` bucket, not a URL.';

-- Exactly one primary image per product, enforced rather than assumed. A
-- partial unique index is the only way to say "unique among the true rows".
create unique index idx_product_images_one_primary
  on public.product_images (product_id)
  where is_primary;

-- The gallery query: every image for one product, in display order.
create index idx_product_images_product_order
  on public.product_images (product_id, display_order);

-- -----------------------------------------------------------------------------
-- product_specifications
-- -----------------------------------------------------------------------------
create table public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  -- Free-form grouping such as 'Display' or 'Connectivity'. Not an enum: the
  -- useful groups differ per product category and adding one must not need a
  -- migration.
  spec_group text,
  name text not null,
  value text not null,
  unit text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),

  constraint product_specifications_name_length check (char_length(name) between 1 and 120),
  constraint product_specifications_value_length check (char_length(value) between 1 and 2000)
);

comment on table public.product_specifications is
  'Unlimited key/value specs per product, optionally grouped. Deliberately not columns on products — the useful attributes of a GPU and a keyboard have nothing in common.';

-- One product cannot list the same attribute twice within a group. COALESCE
-- because NULL <> NULL would let unlimited "ungrouped" duplicates through.
create unique index idx_product_specifications_unique_name
  on public.product_specifications (product_id, coalesce(spec_group, ''), name);

create index idx_product_specifications_product_order
  on public.product_specifications (product_id, display_order);

-- =============================================================================
-- Indexes
-- =============================================================================
-- Each index below names the query it serves. Postgres does not index foreign
-- keys automatically, so join and filter columns are covered explicitly.

-- Identity. Partial on live rows so a soft-deleted product frees its SKU and
-- slug for reuse, which a plain unique constraint would forbid.
create unique index idx_products_sku_live on public.products (sku) where deleted_at is null;
create unique index idx_products_slug_live on public.products (slug) where deleted_at is null;
create unique index idx_brands_slug_live on public.brands (slug) where deleted_at is null;
create unique index idx_categories_slug_live on public.categories (slug) where deleted_at is null;

-- Storefront listing and keyset pagination (D-2). The predicate matches the
-- anonymous read policy exactly, so the index covers only rows a shopper can
-- see — roughly the live catalog rather than every draft and archive.
-- (published_at desc, id desc) is the tiebroken sort key that keyset paging
-- seeks into.
create index idx_products_published_recent
  on public.products (published_at desc, id desc)
  where deleted_at is null and status = 'active' and visibility = 'public';

-- The other offered sort: price. Same partial predicate, same tiebreaker.
create index idx_products_published_price
  on public.products (price_cents, id)
  where deleted_at is null and status = 'active' and visibility = 'public';

-- Category and brand facets. Composite with the sort key so a filtered listing
-- is an index scan rather than a filter-then-sort.
create index idx_products_category_published
  on public.products (category_id, published_at desc, id desc)
  where deleted_at is null and status = 'active' and visibility = 'public';

create index idx_products_brand_published
  on public.products (brand_id, published_at desc, id desc)
  where deleted_at is null and status = 'active' and visibility = 'public';

-- The home page's featured rail. Tiny partial index; featured is a handful of
-- rows out of 50,000.
create index idx_products_featured
  on public.products (published_at desc)
  where deleted_at is null and status = 'active' and visibility = 'public' and is_featured;

-- Storefront full-text search.
create index idx_products_search_vector on public.products using gin (search_vector);

-- Admin fuzzy lookup: an operator typing a partial or slightly wrong SKU.
-- tsvector cannot do this; trigram can. Not partial — admins search archived
-- and draft products too, which is the entire point of an admin search.
create index idx_products_sku_trgm
  on public.products using gin (sku extensions.gin_trgm_ops);

-- Admin list view, which is ordered by recency across every status.
create index idx_products_updated_at on public.products (updated_at desc);

-- Foreign keys used for the admin-side "products in this category/brand" count
-- and for referential integrity checks on delete. The partial storefront
-- indexes above do not serve draft or archived rows.
create index idx_products_category on public.products (category_id) where deleted_at is null;
create index idx_products_brand on public.products (brand_id) where deleted_at is null;

-- Category tree. GIN over the path array answers "everything beneath X" with a
-- containment test; the btree serves the sorted sibling listing of a menu.
create index idx_categories_path on public.categories using gin (path);
create index idx_categories_parent_order on public.categories (parent_id, display_order)
  where deleted_at is null;

-- Brand index page and the featured brand rail.
create index idx_brands_visible_name on public.brands (name)
  where deleted_at is null and is_visible;
create index idx_brands_featured on public.brands (name)
  where deleted_at is null and is_visible and is_featured;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_specifications enable row level security;

-- A single definition of "published", used by every anonymous-facing policy
-- below so the four of them cannot drift apart.
create or replace function public.is_product_published(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.deleted_at is null
      and p.status = 'active'
      and p.visibility = 'public'
      and p.published_at is not null
      and p.published_at <= now()
  );
$$;

comment on function public.is_product_published(uuid) is
  'Single definition of storefront visibility, shared by the product_images and product_specifications policies.';

-- --- products -----------------------------------------------------------------
-- The anonymous contract: published products only. `published_at <= now()`
-- makes scheduled publishing work without a cron job — a future timestamp is
-- simply not visible yet.
create policy "products: public reads published"
  on public.products for select
  to anon, authenticated
  using (
    deleted_at is null
    and status = 'active'
    and visibility = 'public'
    and published_at is not null
    and published_at <= now()
  );

create policy "products: products.read sees everything"
  on public.products for select
  to authenticated
  using (public.has_permission('products.read'));

create policy "products: products.create inserts"
  on public.products for insert
  to authenticated
  with check (public.has_permission('products.create'));

create policy "products: products.update edits"
  on public.products for update
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "products: products.delete removes"
  on public.products for delete
  to authenticated
  using (public.has_permission('products.delete'));

-- --- brands and categories -----------------------------------------------------
-- Visible brands and categories are readable anonymously. They are catalog
-- metadata, not secrets: a product page has to name its brand, and the nav has
-- to list categories. Locking them would push both onto the service-role key
-- and defeat the point of RLS.
create policy "brands: public reads visible"
  on public.brands for select
  to anon, authenticated
  using (deleted_at is null and is_visible);

create policy "brands: brands.read sees everything"
  on public.brands for select
  to authenticated
  using (public.has_permission('brands.read'));

create policy "brands: brands.manage writes"
  on public.brands for all
  to authenticated
  using (public.has_permission('brands.manage'))
  with check (public.has_permission('brands.manage'));

create policy "categories: public reads visible"
  on public.categories for select
  to anon, authenticated
  using (deleted_at is null and is_visible);

create policy "categories: categories.read sees everything"
  on public.categories for select
  to authenticated
  using (public.has_permission('categories.read'));

create policy "categories: categories.manage writes"
  on public.categories for all
  to authenticated
  using (public.has_permission('categories.manage'))
  with check (public.has_permission('categories.manage'));

-- --- product_images and product_specifications ---------------------------------
-- Both inherit visibility from their product. Without the parent check, an
-- unreleased product's photography and spec sheet would be readable by anyone
-- who guessed a product id — a real leak, since specs describe the product.
create policy "product_images: public reads published product images"
  on public.product_images for select
  to anon, authenticated
  using (public.is_product_published(product_id));

create policy "product_images: products.read sees everything"
  on public.product_images for select
  to authenticated
  using (public.has_permission('products.read'));

create policy "product_images: products.update writes"
  on public.product_images for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

create policy "product_specifications: public reads published product specs"
  on public.product_specifications for select
  to anon, authenticated
  using (public.is_product_published(product_id));

create policy "product_specifications: products.read sees everything"
  on public.product_specifications for select
  to authenticated
  using (public.has_permission('products.read'));

create policy "product_specifications: products.update writes"
  on public.product_specifications for all
  to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));
