-- =============================================================================
-- What checkout actually collects
-- =============================================================================
-- The checkout form asks for a first and last name, two phone numbers, a region
-- and a district, and how the customer wants the order — delivered, or collected
-- from a shop. `orders` carries none of that: it has one `customer_name`, one
-- `phone`, one `city` and an `address` that assumes delivery.
--
-- So the migration comes before the form (CLAUDE.md § 12). Building the screen
-- first produces one that collects data with nowhere to put it, which is exactly
-- how K-15 and K-16 happened.
--
-- **Additive only, and ADR-70 is untouched.** `claim_token`, `claimed_at` and the
-- claim path through `place_order()` are carried across verbatim; the function is
-- replaced only because Postgres has no "add a parameter" and its body must gain
-- the new columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- How the customer gets the order
-- -----------------------------------------------------------------------------
-- Two values, because the shop does two things. Not a boolean: `is_pickup` reads
-- as an exception to delivery, and a third option — courier partner, locker —
-- would then need a migration *and* a rewrite of every truthiness check.
create type public.delivery_method as enum ('delivery', 'pickup');

comment on type public.delivery_method is
  'How the customer receives the order. Delivery needs an address; pickup needs a shop.';

alter table public.orders
  -- Nullable, because every order placed before this migration has neither, and
  -- backfilling a guess into somebody's order record would be inventing data.
  add column first_name text,
  add column last_name text,
  -- A second number is genuinely useful here: the manager rings, nobody answers,
  -- and the alternative is an order that dies on a voicemail.
  add column phone_secondary text,
  add column region text,
  add column delivery_method public.delivery_method not null default 'delivery',
  add column pickup_location text;

comment on column public.orders.first_name is
  'Split from customer_name at checkout. customer_name stays authoritative for display and export — these two exist so registration can pre-fill a first and last name field.';

comment on column public.orders.delivery_method is
  'Defaults to delivery: every order that predates this column was one, and that is a fact rather than a guess.';

alter table public.orders
  add constraint orders_first_name_length check (
    first_name is null or char_length(first_name) between 1 and 60
  ),
  add constraint orders_last_name_length check (
    last_name is null or char_length(last_name) between 1 and 60
  ),
  -- Same deliberately loose bound as `phone`: Uzbek numbers are written half a
  -- dozen ways and rejecting a real customer to buy tidiness is a bad trade.
  add constraint orders_phone_secondary_length check (
    phone_secondary is null or char_length(phone_secondary) between 7 and 32
  ),
  add constraint orders_region_length check (
    region is null or char_length(region) between 2 and 120
  ),
  add constraint orders_pickup_location_length check (
    pickup_location is null or char_length(pickup_location) between 2 and 200
  ),
  -- **The invariant that makes the enum worth having.** A delivery with no
  -- address is undeliverable and a pickup with no shop is uncollectable; both
  -- are orders a manager has to ring back about. `address` is `not null` from
  -- the original migration, so a pickup order stores the shop there too and this
  -- only has to police the pickup side.
  add constraint orders_pickup_has_location check (
    delivery_method <> 'pickup' or pickup_location is not null
  );

-- The admin list filters by fulfilment type once both exist — a picker packing
-- collections works a different queue from a courier run.
create index idx_orders_delivery_method
  on public.orders (delivery_method, placed_at desc);

-- -----------------------------------------------------------------------------
-- place_order carries them through
-- -----------------------------------------------------------------------------
-- Every earlier property is preserved exactly: prices read from the catalog and
-- never from the caller (ADR-65), the order and its lines in one transaction, the
-- guard on empty and oversized baskets, and the guest claim token (ADR-70).
--
-- The old four-required-argument signature is dropped at the end, because
-- leaving both would let a caller reach the version that cannot record a
-- delivery method — a second write path is the thing ADR-65 exists to prevent.
create or replace function public.place_order(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_address text,
  p_items jsonb,
  p_phone_secondary text default null,
  p_telegram text default null,
  p_region text default null,
  p_city text default null,
  p_delivery_method public.delivery_method default 'delivery',
  p_pickup_location text default null,
  p_notes text default null,
  p_locale public.locale default 'uz'
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order public.orders;
  item jsonb;
  resolved_name text;
  resolved_sku text;
  resolved_price integer;
  line_quantity integer;
  running_subtotal integer := 0;
  caller uuid := (select auth.uid());
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'an order needs at least one item'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'too many lines in one order'
      using errcode = 'check_violation';
  end if;

  insert into public.orders (
    reference, user_id, locale,
    first_name, last_name, customer_name,
    phone, phone_secondary, telegram,
    region, city, address, delivery_method, pickup_location,
    notes, subtotal_cents, total_cents,
    claim_token
  )
  values (
    'BND-' || lpad(nextval('public.order_reference_seq')::text, 6, '0'),
    caller,
    p_locale,
    p_first_name,
    p_last_name,
    -- Composed, not collected. `customer_name` stays the one field the admin
    -- list, the CSV export and the order detail all read, so nothing downstream
    -- has to learn that a name now arrives in two pieces.
    btrim(p_first_name || ' ' || p_last_name),
    p_phone, p_phone_secondary, p_telegram,
    p_region, p_city, p_address, p_delivery_method, p_pickup_location,
    p_notes,
    0, 0,
    -- ADR-70, unchanged: a guest gets a single-use claim token, a signed-in
    -- customer already owns the row and gets none.
    case when caller is null then gen_random_uuid() else null end
  )
  returning * into new_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    line_quantity := coalesce((item ->> 'quantity')::integer, 0);

    if line_quantity <= 0 then
      raise exception 'every line needs a positive quantity'
        using errcode = 'check_violation';
    end if;

    if (item ->> 'variant_id') is not null then
      select
        coalesce(pt.name, pt_uz.name, p.sku),
        v.sku,
        coalesce(v.sale_price_cents, v.price_cents)
      into resolved_name, resolved_sku, resolved_price
      from public.product_variants v
      join public.products p on p.id = v.product_id
      left join public.product_translations pt
        on pt.product_id = p.id and pt.locale = p_locale
      left join public.product_translations pt_uz
        on pt_uz.product_id = p.id and pt_uz.locale = 'uz'
      where v.id = (item ->> 'variant_id')::uuid
        and v.deleted_at is null
        and v.is_active
        and p.deleted_at is null
        and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null
        and p.published_at <= now();
    else
      select
        coalesce(pt.name, pt_uz.name, p.sku),
        p.sku,
        coalesce(p.sale_price_cents, p.price_cents)
      into resolved_name, resolved_sku, resolved_price
      from public.products p
      left join public.product_translations pt
        on pt.product_id = p.id and pt.locale = p_locale
      left join public.product_translations pt_uz
        on pt_uz.product_id = p.id and pt_uz.locale = 'uz'
      where p.id = (item ->> 'product_id')::uuid
        and p.deleted_at is null
        and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null
        and p.published_at <= now();
    end if;

    if resolved_price is null then
      raise exception 'a product in this order is no longer available'
        using errcode = 'no_data_found';
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id,
      product_name, sku, unit_price_cents, quantity, line_total_cents
    )
    values (
      new_order.id,
      (item ->> 'product_id')::uuid,
      (item ->> 'variant_id')::uuid,
      resolved_name, resolved_sku,
      resolved_price, line_quantity, resolved_price * line_quantity
    );

    running_subtotal := running_subtotal + resolved_price * line_quantity;
  end loop;

  update public.orders
  set subtotal_cents = running_subtotal,
      total_cents = running_subtotal + delivery_fee_cents
  where id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;

comment on function public.place_order(text, text, text, text, jsonb, text, text, text, text, public.delivery_method, text, text, public.locale) is
  'Creates an order and its lines in one transaction, pricing every line from the database. Issues a single-use claim_token for guest orders (ADR-70). The only write path into orders.';

grant execute on function public.place_order(
  text, text, text, text, jsonb, text, text, text, text,
  public.delivery_method, text, text, public.locale
) to anon, authenticated;

-- The superseded signature. Dropped rather than left beside the new one: two
-- overloads means a caller can reach the one that cannot record a delivery
-- method, and a second write path into `orders` is precisely what ADR-65 exists
-- to prevent.
drop function if exists public.place_order(
  text, text, text, jsonb, text, text, text, public.locale
);
