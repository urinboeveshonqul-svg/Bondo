-- =============================================================================
-- Order ownership: three paths, one hierarchy
-- =============================================================================
-- ADR-70 gave a guest order exactly one route into an account: a single-use
-- capability token held in an httpOnly cookie. That remains the primary
-- mechanism and is untouched below. This migration adds two more, and the point
-- of the exercise is that they are **ranked by the strength of the proof they
-- require**, not merely stacked up:
--
--   1. **Claim token** (ADR-70) — proof the caller *is the browser that placed
--      the order*. Unguessable, single use, never leaves the server. Strongest,
--      and tried first.
--   2. **Verified email** (ADR-71, below) — proof the caller *controls the
--      mailbox the order was placed with*. Weaker than a capability, because
--      the address is typed rather than issued, but it is real proof: Supabase
--      has confirmed the mailbox, and the guest chose that address at checkout.
--   3. **An administrator, by hand** — no automatic proof at all. A human
--      verified ownership out of band and is accountable for it, which is why
--      this path is the only one that names an actor in the audit log.
--
-- What is *not* a path, and must never become one: matching on phone number or
-- order reference. Neither is secret. A phone number is on a business card; a
-- reference is sequential so a manager can read it down the phone. Both were
-- rejected in ADR-70 and the reasoning has not changed.
--
-- -----------------------------------------------------------------------------
-- Every ownership change is logged
-- -----------------------------------------------------------------------------
-- All three functions write an `audit_logs` row. That table is append-only and
-- immutable even to `service_role` (ADR-27), so the record of who took
-- ownership of what cannot be edited afterwards — including by the person who
-- took it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The email a guest optionally leaves
-- -----------------------------------------------------------------------------
-- Nullable, and it stays nullable. Checkout does not require an email and must
-- not start: this shop rings people, and a required address nobody reads is a
-- field that costs conversions (ADR-63). This column exists so that a guest who
-- *does* leave one can be reunited with their order after verifying it.
alter table public.orders add column email text;

comment on column public.orders.email is
  'Optional. Only used to reunite a guest with their order after they verify the same address on an account (ADR-71). Never used to contact them — that is what phone and telegram are for.';

alter table public.orders
  add constraint orders_email_shape check (
    email is null or (char_length(email) between 3 and 320 and position('@' in email) > 1)
  );

-- Case-insensitive, because a mailbox is. Partial, because most orders have no
-- email and should not sit in this index.
create index idx_orders_email_unclaimed
  on public.orders (lower(email))
  where email is not null and user_id is null;

-- -----------------------------------------------------------------------------
-- place_order records it
-- -----------------------------------------------------------------------------
-- One added parameter, at the end so every existing call site keeps working.
-- The body is 20260813001000's, unchanged apart from the column.
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
  p_locale public.locale default 'uz',
  p_email text default null
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
    phone, phone_secondary, telegram, email,
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
    btrim(p_first_name || ' ' || p_last_name),
    p_phone, p_phone_secondary, p_telegram, lower(nullif(btrim(p_email), '')),
    p_region, p_city, p_address, p_delivery_method, p_pickup_location,
    p_notes,
    0, 0,
    -- ADR-70, unchanged.
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
        coalesce(pt.name, pt_uz.name, p.sku), v.sku,
        coalesce(v.sale_price_cents, v.price_cents)
      into resolved_name, resolved_sku, resolved_price
      from public.product_variants v
      join public.products p on p.id = v.product_id
      left join public.product_translations pt
        on pt.product_id = p.id and pt.locale = p_locale
      left join public.product_translations pt_uz
        on pt_uz.product_id = p.id and pt_uz.locale = 'uz'
      where v.id = (item ->> 'variant_id')::uuid
        and v.deleted_at is null and v.is_active
        and p.deleted_at is null and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null and p.published_at <= now();
    else
      select
        coalesce(pt.name, pt_uz.name, p.sku), p.sku,
        coalesce(p.sale_price_cents, p.price_cents)
      into resolved_name, resolved_sku, resolved_price
      from public.products p
      left join public.product_translations pt
        on pt.product_id = p.id and pt.locale = p_locale
      left join public.product_translations pt_uz
        on pt_uz.product_id = p.id and pt_uz.locale = 'uz'
      where p.id = (item ->> 'product_id')::uuid
        and p.deleted_at is null and p.status = 'active'
        and p.visibility = 'public'
        and p.published_at is not null and p.published_at <= now();
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

grant execute on function public.place_order(
  text, text, text, text, jsonb, text, text, text, text,
  public.delivery_method, text, text, public.locale, text
) to anon, authenticated;

drop function if exists public.place_order(
  text, text, text, text, jsonb, text, text, text, text,
  public.delivery_method, text, text, public.locale
);

-- -----------------------------------------------------------------------------
-- One place that records an ownership change
-- -----------------------------------------------------------------------------
-- Every path calls this, so "all ownership changes are logged" is a property of
-- the schema rather than a promise three functions each have to keep.
create or replace function public.log_order_ownership(
  p_order_id uuid,
  p_new_owner uuid,
  p_method text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    action, resource_type, resource_id, actor_id, actor_email, metadata
  )
  values (
    'order.ownership_transferred',
    'order',
    p_order_id,
    p_actor,
    (select u.email from auth.users u where u.id = p_actor),
    jsonb_build_object(
      -- Which of the three paths was used. An audit row that does not say how
      -- ownership moved cannot answer the only question ever asked of it.
      'method', p_method,
      'new_owner', p_new_owner
    )
  );
end;
$$;

comment on function public.log_order_ownership(uuid, uuid, text, uuid) is
  'Writes the append-only audit row for an ownership change. Called by every claim path so the guarantee is structural.';

-- -----------------------------------------------------------------------------
-- 1. Claim token — ADR-70, now logging
-- -----------------------------------------------------------------------------
-- The predicate is byte-for-byte the one from 20260812001000. The only change is
-- the audit row; the security properties are untouched.
create or replace function public.claim_orders(p_tokens uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimant uuid := (select auth.uid());
  claimed integer := 0;
  moved uuid;
begin
  if claimant is null then
    raise exception 'sign in before claiming an order'
      using errcode = 'insufficient_privilege';
  end if;

  if p_tokens is null or array_length(p_tokens, 1) is null then
    return 0;
  end if;

  if array_length(p_tokens, 1) > 20 then
    raise exception 'too many claims in one request'
      using errcode = 'check_violation';
  end if;

  for moved in
    update public.orders
    set user_id = claimant, claimed_at = now(), claim_token = null
    where claim_token = any(p_tokens) and user_id is null
    returning id
  loop
    claimed := claimed + 1;
    perform public.log_order_ownership(moved, claimant, 'claim_token', claimant);
  end loop;

  return claimed;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Verified email — ADR-71
-- -----------------------------------------------------------------------------
-- **The confirmation check is the entire security of this path.** Without it,
-- anybody could register with any address and take the orders placed under it;
-- with it, Supabase has proven the caller opened mail sent to that mailbox and
-- the guest chose that address at checkout.
--
-- Reads `auth.users.email_confirmed_at` rather than trusting a JWT claim: a
-- token is issued once and this is asked now.
create or replace function public.claim_orders_by_email()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimant uuid := (select auth.uid());
  verified_email text;
  claimed integer := 0;
  moved uuid;
begin
  if claimant is null then
    return 0;
  end if;

  select lower(u.email) into verified_email
  from auth.users u
  where u.id = claimant
    -- Unverified means unproven. Returning zero rather than raising, because an
    -- unverified account calling this is the normal state between registering
    -- and clicking the link, not an error.
    and u.email_confirmed_at is not null;

  if verified_email is null then
    return 0;
  end if;

  for moved in
    update public.orders
    set user_id = claimant, claimed_at = now(), claim_token = null
    where lower(email) = verified_email
      -- Never overwrite an owner, and never touch an order already claimed.
      and user_id is null
    returning id
  loop
    claimed := claimed + 1;
    perform public.log_order_ownership(moved, claimant, 'verified_email', claimant);
  end loop;

  return claimed;
end;
$$;

comment on function public.claim_orders_by_email() is
  'Attaches unowned guest orders whose email matches the caller''s VERIFIED address (ADR-71). Returns 0 for an unverified account. Never overwrites an existing owner.';

grant execute on function public.claim_orders_by_email() to authenticated;
revoke execute on function public.claim_orders_by_email() from anon;

-- -----------------------------------------------------------------------------
-- 3. An administrator, by hand
-- -----------------------------------------------------------------------------
-- For the customer who cleared their cookies and never left an email — the
-- fallback ADR-70 deliberately left open. Support verifies ownership out of
-- band (they have the phone number, the reference and the person on the line)
-- and attaches it.
--
-- Still refuses to reassign an owned order. "Verified out of band" is a reason
-- to give an unowned order a home, not a licence to move somebody else's.
create or replace function public.admin_link_order(
  p_order_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  linked integer;
begin
  if not public.has_permission('orders.update') then
    raise exception 'not permitted to link orders'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'no such customer'
      using errcode = 'foreign_key_violation';
  end if;

  update public.orders
  set user_id = p_user_id, claimed_at = now(), claim_token = null
  where id = p_order_id and user_id is null;

  get diagnostics linked = row_count;

  if linked = 0 then
    return false;
  end if;

  -- The actor is the administrator, not the recipient — this is the one path
  -- where those differ, and it is the whole reason the column exists.
  perform public.log_order_ownership(p_order_id, p_user_id, 'admin_manual', actor);

  return true;
end;
$$;

comment on function public.admin_link_order(uuid, uuid) is
  'Attaches an UNOWNED guest order to a customer, for support who verified ownership out of band. Requires orders.update. Refuses to reassign an owned order. Audited with the administrator as actor.';

grant execute on function public.admin_link_order(uuid, uuid) to authenticated;
revoke execute on function public.admin_link_order(uuid, uuid) from anon;
