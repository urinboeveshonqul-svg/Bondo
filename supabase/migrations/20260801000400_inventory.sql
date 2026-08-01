-- =============================================================================
-- Inventory: current level and immutable movement ledger
-- =============================================================================
-- The requirement is "never overwrite inventory silently; always create
-- movement records". That is enforced here, not documented and hoped for:
--
--   public.inventory            one row per product, the current level
--   public.inventory_movements  append-only ledger of every change
--
-- `inventory.quantity_on_hand` is derived state. It exists because summing the
-- ledger on every product page would not survive 50,000 products. It is kept
-- correct by a trigger on the ledger, and a second trigger REJECTS any UPDATE
-- that changes it by another route. Someone in Supabase Studio typing a new
-- number into the quantity column gets an exception, not a silent divergence.
--
-- Stock therefore has exactly one home. products has no stock column, because
-- two writable copies of a number are two numbers (ADR-24).
-- =============================================================================

create type public.inventory_movement_type as enum (
  'purchase',    -- stock arriving from a supplier
  'adjustment',  -- deliberate operational change: damage, loss, promotion
  'correction',  -- fixing a previous mistake, e.g. after a stock count
  'sale',        -- reserved for Phase 4 checkout
  'return'       -- reserved for Phase 8 returns
);

comment on type public.inventory_movement_type is
  '`sale` and `return` are declared now and unused until Phases 4 and 8. Declaring them here means the ledger never needs an enum migration mid-checkout.';

-- -----------------------------------------------------------------------------
-- inventory
-- -----------------------------------------------------------------------------
create table public.inventory (
  -- product_id is the primary key: one inventory row per product, and the 1:1
  -- relationship is impossible to violate.
  product_id uuid primary key references public.products (id) on delete cascade,

  quantity_on_hand integer not null default 0,
  -- Committed to open orders but not yet shipped. Written by Phase 4; declared
  -- now so available stock has a stable definition from the start.
  quantity_reserved integer not null default 0,

  low_stock_threshold integer not null default 0,
  -- Off by default: most computer parts are not restockable on demand, and a
  -- false backorder promise is worse than an out-of-stock label.
  allow_backorder boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_quantity_on_hand_non_negative check (quantity_on_hand >= 0),
  constraint inventory_quantity_reserved_non_negative check (quantity_reserved >= 0),
  constraint inventory_low_stock_threshold_non_negative check (low_stock_threshold >= 0),
  -- Cannot reserve more than exists. The oversell guard Phase 4 will lean on.
  constraint inventory_reserved_within_on_hand check (quantity_reserved <= quantity_on_hand)
);

comment on table public.inventory is
  'Current stock per product. quantity_on_hand is derived from inventory_movements and may only change through it.';
comment on column public.inventory.quantity_reserved is
  'Committed to unfulfilled orders. Unused until Phase 4.';

create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- Every product needs an inventory row, or "in stock?" becomes a NULL check at
-- every call site. Created automatically so no code path can forget.
create or replace function public.create_inventory_for_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory (product_id)
  values (new.id)
  on conflict (product_id) do nothing;
  return new;
end;
$$;

comment on function public.create_inventory_for_product() is
  'AFTER INSERT on products: guarantees every product has an inventory row from birth.';

create trigger products_create_inventory
  after insert on public.products
  for each row execute function public.create_inventory_for_product();

-- -----------------------------------------------------------------------------
-- inventory_movements
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,

  movement_type public.inventory_movement_type not null,
  -- Signed: negative removes stock. Zero is meaningless and rejected, because a
  -- zero-quantity movement is always a bug in the caller.
  quantity_delta integer not null,

  -- The level after this movement, stamped by the trigger that applied it.
  -- Storing it makes the ledger auditable on its own: a reader can verify the
  -- running total without replaying every prior row.
  quantity_after integer not null,

  reason text,
  -- Free-form pointer to whatever caused this: a purchase order number now, an
  -- order id from Phase 4. Not a foreign key, because the referenced table
  -- differs per movement type and does not all exist yet.
  reference text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint inventory_movements_delta_non_zero check (quantity_delta <> 0),
  constraint inventory_movements_quantity_after_non_negative check (quantity_after >= 0),
  constraint inventory_movements_reason_length check (
    reason is null or char_length(reason) <= 500
  )
);

comment on table public.inventory_movements is
  'Append-only stock ledger. No UPDATE or DELETE policy exists, and a trigger refuses both — a wrong movement is corrected by recording a `correction`, never by editing history.';
comment on column public.inventory_movements.quantity_after is
  'Set by trigger from the resulting inventory row. Client-supplied values are overwritten.';

-- Per-product history, newest first — the "why is this number what it is"
-- query an operator runs when stock looks wrong.
create index idx_inventory_movements_product_recent
  on public.inventory_movements (product_id, created_at desc);

-- The global recent-activity feed on the inventory dashboard.
create index idx_inventory_movements_recent
  on public.inventory_movements (created_at desc);

-- Reorder report: everything at or below its threshold. The predicate compares
-- two columns, which a partial index is allowed to do, so the report never
-- scans products that are comfortably stocked.
create index idx_inventory_low_stock
  on public.inventory (product_id)
  where quantity_on_hand <= low_stock_threshold;

-- -----------------------------------------------------------------------------
-- The ledger drives the level
-- -----------------------------------------------------------------------------
-- Transaction-local GUC as the handshake between the two triggers. Set with
-- is_local = true so it dies with the transaction and cannot leak into the next
-- statement on a pooled connection.
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
  perform 1 from public.inventory where product_id = new.product_id for update;

  if not found then
    insert into public.inventory (product_id) values (new.product_id)
    on conflict (product_id) do nothing;
  end if;

  perform set_config('app.inventory_movement', 'on', true);

  update public.inventory
  set quantity_on_hand = quantity_on_hand + new.quantity_delta
  where product_id = new.product_id
  returning quantity_on_hand into new_quantity;

  perform set_config('app.inventory_movement', '', true);

  -- Authoritative regardless of what the caller supplied.
  new.quantity_after := new_quantity;
  return new;
end;
$$;

comment on function public.apply_inventory_movement() is
  'BEFORE INSERT on inventory_movements: applies the delta to inventory under a row lock and stamps quantity_after.';

create trigger inventory_movements_apply
  before insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- The guard. Without it, `update inventory set quantity_on_hand = 500` from
-- Studio would succeed and the ledger would no longer explain the number.
-- The NOT NULL check constraint above stops the level going negative, so an
-- over-large negative movement aborts the whole transaction, ledger row
-- included.
create or replace function public.guard_inventory_quantity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quantity_on_hand is distinct from old.quantity_on_hand
     and coalesce(current_setting('app.inventory_movement', true), '') <> 'on' then
    raise exception
      'quantity_on_hand may only change by inserting into inventory_movements (product %)', new.product_id
      using errcode = 'restrict_violation',
            hint = 'Insert an inventory_movements row with the desired quantity_delta.';
  end if;
  return new;
end;
$$;

comment on function public.guard_inventory_quantity() is
  'BEFORE UPDATE on inventory: rejects any change to quantity_on_hand not made by apply_inventory_movement().';

create trigger inventory_guard_quantity
  before update on public.inventory
  for each row execute function public.guard_inventory_quantity();

-- History is history. Correct a mistake with a `correction` movement.
create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on % is not allowed: this table is append-only', tg_op, tg_table_name
    using errcode = 'restrict_violation',
          hint = 'Record a compensating row instead of editing or deleting history.';
end;
$$;

comment on function public.reject_ledger_mutation() is
  'BEFORE UPDATE OR DELETE trigger for append-only tables. Applies to every role, including service_role, which RLS alone cannot constrain.';

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function public.reject_ledger_mutation();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;

-- Stock levels are NOT anonymously readable. "12 left" is a merchandising
-- decision Phase 3 will make deliberately through a view or a service that
-- exposes availability without the exact figure; leaking precise stock and
-- reorder thresholds to competitors by default is not that decision.
create policy "inventory: inventory.read views levels"
  on public.inventory for select
  to authenticated
  using (public.has_permission('inventory.read'));

-- Only the threshold and backorder flag are directly editable. The guard
-- trigger rejects a quantity change regardless of this policy, so the two
-- mechanisms agree: policy decides who may touch the row, trigger decides which
-- column may move.
create policy "inventory: inventory.adjust edits settings"
  on public.inventory for update
  to authenticated
  using (public.has_permission('inventory.adjust'))
  with check (public.has_permission('inventory.adjust'));

create policy "inventory_movements: inventory.read views history"
  on public.inventory_movements for select
  to authenticated
  using (public.has_permission('inventory.read'));

create policy "inventory_movements: inventory.adjust records"
  on public.inventory_movements for insert
  to authenticated
  with check (public.has_permission('inventory.adjust'));

-- No UPDATE or DELETE policy on inventory_movements, and no INSERT policy on
-- inventory: rows are created by the product trigger, and levels move only
-- through the ledger.
