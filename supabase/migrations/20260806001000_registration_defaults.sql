-- =============================================================================
-- Registration defaults: never leave an orphaned user
-- =============================================================================
-- Phase 4A requires that a successful registration leaves a complete customer,
-- not an `auth.users` row with nothing attached. `handle_new_user()` already
-- created the profile; it did not create the default wishlist, so the first
-- "save for later" of every new account would have had nowhere to go.
--
-- Both rows are created in **one trigger, inside the same transaction as the
-- signup**. Doing it in application code after `signUp()` returns would mean a
-- user whose network dropped between the two calls exists with no profile —
-- and the application cannot retry it, because by then the caller may not be
-- authenticated. A trigger cannot half-happen.
--
-- -----------------------------------------------------------------------------
-- What is deliberately NOT created here
-- -----------------------------------------------------------------------------
-- **No "customer" role.** The brief asks for a default customer role, and this
-- schema does not have one — deliberately, since Phase 2 (ADR-21, ADR-22).
-- Roles exist to carry *staff* permissions; a customer holds none. Being a
-- customer is the absence of an `admins` row, and every customer-facing policy
-- keys off `auth.uid() = user_id` rather than a role. Inserting a permissionless
-- `customer` role would add a row that grants nothing, that no policy reads, and
-- that a future reader would reasonably assume was load-bearing. Recorded as
-- ADR-59.
--
-- **No per-user settings row.** `public.settings` is a store-wide key/value
-- table, not a per-user one, and there is no feature yet that needs a
-- per-customer preference: language lives in the URL and the `NEXT_LOCALE`
-- cookie, and email preferences arrive with transactional email in Phase 8.
-- Creating an empty table now would be scaffolding for a feature nobody has
-- specified (CLAUDE.md § 3).
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    -- Supabase places OAuth profile data in raw_user_meta_data. Both spellings
    -- appear across providers.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;

  -- The default list every "save for later" goes into. `is_default` is covered
  -- by a partial unique index, so the `on conflict do nothing` also makes this
  -- idempotent if the trigger is ever re-run against an existing user.
  insert into public.wishlists (user_id, name, is_default)
  values (new.id, 'My wishlist', true)
  on conflict do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users: creates the profile and the default wishlist, in the signup transaction.';

-- -----------------------------------------------------------------------------
-- Backfill
-- -----------------------------------------------------------------------------
-- Any account that registered before this migration has a profile and no
-- wishlist. There are none today — `profiles` is empty on the hosted project —
-- but the statement is written anyway: a migration that only works on an empty
-- database is a migration that fails the first time it matters.
insert into public.wishlists (user_id, name, is_default)
select p.id, 'My wishlist', true
from public.profiles p
where not exists (
  select 1 from public.wishlists w where w.user_id = p.id and w.is_default
);
