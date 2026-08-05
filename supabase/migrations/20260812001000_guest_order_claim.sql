-- =============================================================================
-- Claiming a guest order
-- =============================================================================
-- A shopper orders without an account (ADR-63: guest checkout is the primary
-- path), then registers from the confirmation page. Their order has to end up in
-- their order history — **the same row**, moved, never copied.
--
-- -----------------------------------------------------------------------------
-- Why this is not "match on phone number"
-- -----------------------------------------------------------------------------
-- The obvious implementation is: on registration, claim every order whose
-- `phone` matches the new profile's. It is also a data-disclosure hole, and a
-- cheap one to exploit. A phone number is not a secret — it is on business
-- cards, in chat groups, on the side of a van. Anyone who knows a customer's
-- number could register with it and immediately read that customer's name,
-- delivery address, basket and order totals.
--
-- The same objection applies to matching on the order reference. `BND-001042` is
-- sequential by design, because a manager reads it down the phone; anyone
-- holding one reference can guess a thousand others.
--
-- So a claim needs proof that the claimant is the person who placed the order,
-- and the only party who has that proof is the browser that placed it. Hence a
-- **capability token**:
--
--   * `claim_token` is a random uuid, issued by `place_order()` and returned
--     only to the caller who placed the order. It is never displayed, never in
--     a URL, and never derivable from anything the order shows.
--   * It is **single use**: claiming nulls it. A token that leaks later opens
--     nothing.
--   * It is only issued for **guest** orders. An order placed by a signed-in
--     customer already has an owner and needs no claim path.
--   * The application keeps it in an httpOnly cookie, so it is not readable by
--     script and does not survive into analytics or a referrer header.
--
-- The trade is that a guest who clears their cookies loses the automatic link.
-- That is the correct way to fail: they still have the order, the shop still has
-- their phone number, and support can attach it by hand. The alternative fails
-- the other way — silently, in favour of whoever guessed a phone number.
-- =============================================================================

alter table public.orders
  add column claim_token uuid,
  add column claimed_at timestamptz;

comment on column public.orders.claim_token is
  'Single-use capability token proving the holder placed this guest order. Issued by place_order() for guest orders only, nulled on claim. Never shown to a user and never in a URL.';

comment on column public.orders.claimed_at is
  'When a guest order was attached to an account. Null for orders that were never guest orders, and for guest orders still unclaimed.';

-- Unique so a token identifies exactly one order, and partial so the many rows
-- with a null token do not compete for the index.
create unique index idx_orders_claim_token
  on public.orders (claim_token)
  where claim_token is not null;

-- -----------------------------------------------------------------------------
-- place_order issues the token
-- -----------------------------------------------------------------------------
-- Replaced whole rather than patched: the body is the one from
-- 20260809001000 with the claim token added at the insert. Everything else —
-- prices read from the catalog, one transaction, the guard on empty baskets —
-- is unchanged and still the reason this function exists (ADR-65).
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb,
  p_telegram text default null,
  p_city text default null,
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
    customer_name, phone, telegram, address, city, notes,
    subtotal_cents, total_cents,
    -- Guests get a token; a signed-in customer already owns the row.
    claim_token
  )
  values (
    'BND-' || lpad(nextval('public.order_reference_seq')::text, 6, '0'),
    caller,
    p_locale,
    p_customer_name, p_phone, p_telegram, p_address, p_city, p_notes,
    0, 0,
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

comment on function public.place_order(text, text, text, jsonb, text, text, text, public.locale) is
  'Creates an order and its lines in one transaction, pricing every line from the database. Issues a single-use claim_token for guest orders. The only write path into orders.';

-- -----------------------------------------------------------------------------
-- claim_orders — attach guest orders to the caller's account
-- -----------------------------------------------------------------------------
-- Takes the tokens the browser is holding and moves any that still match an
-- unclaimed guest order. **Moves, never copies**: it is an `update` of
-- `user_id`, so the reference, the lines, the timeline and the totals are the
-- same row the manager has been working.
--
-- `security definer` because the caller cannot see the order yet — that is the
-- point. RLS lets a customer read `user_id = auth.uid()`, and before the claim
-- the row has no user at all, so a plain update would match nothing.
--
-- Every guard that matters is in the `where`:
--
--   * `claim_token = any(...)` — the caller must hold the token.
--   * `user_id is null` — an order that already has an owner is never
--     reassigned, so a replayed token cannot steal a claimed order.
--
-- Idempotent: a second call with the same tokens matches nothing and returns 0.
create or replace function public.claim_orders(p_tokens uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimant uuid := (select auth.uid());
  claimed integer;
begin
  if claimant is null then
    raise exception 'sign in before claiming an order'
      using errcode = 'insufficient_privilege';
  end if;

  if p_tokens is null or array_length(p_tokens, 1) is null then
    return 0;
  end if;

  -- A browser holding more than a handful of unclaimed guest orders is a
  -- scraped cookie, not a shopper. Bounded so a single call cannot be used to
  -- sweep a stolen token list.
  if array_length(p_tokens, 1) > 20 then
    raise exception 'too many claims in one request'
      using errcode = 'check_violation';
  end if;

  update public.orders
  set user_id = claimant,
      claimed_at = now(),
      -- Single use. The token is spent whether or not it is ever sent again.
      claim_token = null
  where claim_token = any(p_tokens)
    and user_id is null;

  get diagnostics claimed = row_count;

  return claimed;
end;
$$;

comment on function public.claim_orders(uuid[]) is
  'Attaches unclaimed guest orders to the calling user, one row per held token. Moves ownership rather than copying; single-use and idempotent.';

grant execute on function public.claim_orders(uuid[]) to authenticated;

-- Deliberately **not** granted to `anon`. Claiming requires an account to claim
-- into, and the function refuses a null `auth.uid()` anyway — the missing grant
-- is the second gate (ADR-30).
revoke execute on function public.claim_orders(uuid[]) from anon;

-- -----------------------------------------------------------------------------
-- The claim token is never readable through the API
-- -----------------------------------------------------------------------------
-- `orders` grants `select` to `authenticated`, and a customer can read their own
-- rows — which after a claim includes the row the token belonged to. The token
-- is nulled on claim so there is nothing left to read, but an *unclaimed* guest
-- order must not expose its token to anybody either.
--
-- No policy allows an anonymous select on `orders` at all, and a signed-in
-- customer only matches `user_id = auth.uid()`, which an unclaimed guest order
-- never satisfies. Staff holding `orders.read` can see the column; that is
-- acceptable and useful — support attaching an order by hand is exactly the
-- fallback this design leaves open.
