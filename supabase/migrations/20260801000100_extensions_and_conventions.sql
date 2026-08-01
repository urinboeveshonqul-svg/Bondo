-- =============================================================================
-- Extensions and shared conventions
-- =============================================================================
-- Every table in this schema follows the same conventions. They are implemented
-- once here and reused, so that "add a table" never means "reinvent auditing".
--
--   id           uuid primary key default gen_random_uuid()
--   created_at   timestamptz not null default now()
--   updated_at   timestamptz not null default now()   -- maintained by trigger
--   created_by   uuid references auth.users           -- set by trigger, where kept
--   updated_by   uuid references auth.users           -- set by trigger, where kept
--   deleted_at   timestamptz                          -- soft delete, where kept
--
-- Soft delete is applied only where a row is referenced by history that must
-- survive it (products, categories, brands, admins). Rows owned entirely by one
-- user (wishlists) or by an append-only ledger (inventory_movements,
-- audit_logs) are not soft-deleted: the former are the user's to destroy, the
-- latter are never deleted at all.
-- =============================================================================

-- pg_trgm backs fuzzy SKU/name lookup in the admin console, where an operator
-- types a partial or slightly wrong SKU. Full-text search (tsvector) handles
-- storefront search; trigram handles "close enough" matching, which tsvector
-- cannot do. Installed into `extensions` per Supabase convention rather than
-- into `public`, so the application schema holds only application objects.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- updated_at
-- -----------------------------------------------------------------------------
-- A column default cannot maintain updated_at, because a default only applies
-- on INSERT. A trigger is the only way to keep it honest on UPDATE, and doing
-- it in the database rather than the application means a psql session or a
-- Supabase Studio edit cannot bypass it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at. Attached to every table carrying that column.';

-- -----------------------------------------------------------------------------
-- created_by / updated_by
-- -----------------------------------------------------------------------------
-- auth.uid() is NULL for service-role and for SQL run outside a request (jobs,
-- migrations, seeds). NULL therefore means "the system did this", which is a
-- meaningful value and not an error.
create or replace function public.set_row_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    -- created_by is immutable: reassert the stored value rather than trusting
    -- whatever the client sent.
    new.created_by := old.created_by;
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

comment on function public.set_row_actor() is
  'BEFORE INSERT OR UPDATE trigger: stamps created_by/updated_by from auth.uid() and keeps created_by immutable.';

-- -----------------------------------------------------------------------------
-- Slug validation
-- -----------------------------------------------------------------------------
-- Slugs are persisted, never derived on read (ADR-3). This constraint is the
-- database half of that contract; utils/slug.ts is the application half. Both
-- exist because the database is reachable from Studio and psql, where the
-- TypeScript helper is not.
create or replace function public.is_valid_slug(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';
$$;

comment on function public.is_valid_slug(text) is
  'Lowercase alphanumeric words joined by single hyphens, no leading/trailing hyphen.';
