-- =============================================================================
-- Wishlists
-- =============================================================================
-- Schema only. The wishlist feature ships in Phase 7; the tables exist now
-- because they belong to the same identity model as profiles and would
-- otherwise need a second RLS review later.
--
-- Modelled as lists-of-items rather than a flat user/product join because
-- "Gaming build" and "Work machine" are different lists to a shopper, and
-- collapsing them later means a data migration.
-- =============================================================================

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  name text not null default 'My wishlist',
  -- Exactly one default list per user, enforced by a partial unique index
  -- below. The default is where "save for later" goes without asking.
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wishlists_name_length check (char_length(name) between 1 and 120)
);

comment on table public.wishlists is
  'User-owned product lists. Hard delete, not soft: this is the user''s data and "delete" must mean delete.';

create trigger wishlists_set_updated_at
  before update on public.wishlists
  for each row execute function public.set_updated_at();

-- A user's lists, and the ownership lookup every wishlist_items policy makes.
create index idx_wishlists_user on public.wishlists (user_id);

create unique index idx_wishlists_one_default_per_user
  on public.wishlists (user_id)
  where is_default;

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  -- CASCADE: if a product is hard-deleted the saved entry is meaningless. Note
  -- that the normal retirement path is a soft delete, which leaves the item in
  -- place so the shopper still sees what they saved.
  product_id uuid not null references public.products (id) on delete cascade,

  note text,
  created_at timestamptz not null default now(),

  constraint wishlist_items_note_length check (
    note is null or char_length(note) <= 500
  )
);

comment on table public.wishlist_items is
  'Products saved to a list. Unique per (list, product) — saving twice is a no-op, not a duplicate row.';

create unique index idx_wishlist_items_unique
  on public.wishlist_items (wishlist_id, product_id);

-- "How many people saved this product?" — merchandising signal in Phase 7, and
-- the index that makes the reverse lookup from a product not a full scan.
create index idx_wishlist_items_product on public.wishlist_items (product_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

-- Wishlists are private. No admin policy: what a customer saved is not
-- operational data, and support does not need it to answer a question about an
-- order. If a business reason appears later it gets its own permission and its
-- own policy, deliberately.
create policy "wishlists: owner does everything"
  on public.wishlists for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Ownership is transitive through the parent list. EXISTS rather than a join so
-- the planner can stop at the first matching row.
create policy "wishlist_items: owner does everything"
  on public.wishlist_items for all
  to authenticated
  using (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id
        and w.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.wishlists w
      where w.id = wishlist_id
        and w.user_id = (select auth.uid())
    )
  );
