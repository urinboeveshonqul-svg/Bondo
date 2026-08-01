-- =============================================================================
-- Identity and role-based access control
-- =============================================================================
-- Two distinct ideas, deliberately kept in separate tables:
--
--   profiles  every authenticated user has one. Customer-facing data.
--   admins    the subset of users who are staff. Being absent from this table
--             is what makes someone "not staff" — there is no is_admin column
--             on profiles that a mis-scoped UPDATE could flip.
--
-- Permissions are never stored on a user. A user has roles; roles have
-- permissions. Granting an eleventh admin the same access as the other ten is
-- one INSERT into user_roles, and revoking a capability from every holder at
-- once is one DELETE from role_permissions. That is the property the design
-- targets ask for at 100+ administrators.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  -- Shares the primary key with auth.users rather than carrying a separate id:
  -- one identity, one key, and no way for the two to disagree.
  id uuid primary key references auth.users (id) on delete cascade,

  full_name text,
  -- Storage object path within the `avatars` bucket, not a URL. URLs embed the
  -- project host and would all break on a project move or CDN change.
  avatar_path text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_full_name_length check (
    full_name is null or char_length(full_name) between 1 and 200
  ),
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+?[0-9 ()-]{4,32}$'
  )
);

comment on table public.profiles is
  'Public-facing user data, 1:1 with auth.users. Deleting the auth user deletes this row.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every authenticated user needs a profile row to exist before the application
-- can read it. Creating it in the application would mean every code path that
-- can be the user's first request has to remember to; a trigger on auth.users
-- cannot be forgotten. SECURITY DEFINER because the auth schema is not writable
-- by the roles that trigger signup.
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
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'AFTER INSERT on auth.users: creates the matching profile row.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- roles, permissions, role_permissions
-- -----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  -- System roles are seeded by migration and referenced by application logic.
  -- Deleting one would break that logic, so deletion is blocked below.
  is_system boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  constraint roles_key_format check (public.is_valid_slug(replace(key, '_', '-')))
);

comment on table public.roles is
  'Named bundles of permissions. Users are granted roles, never permissions directly.';

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();
create trigger roles_set_row_actor
  before insert or update on public.roles
  for each row execute function public.set_row_actor();

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  -- `resource.action`, e.g. products.update. The pair is also stored split out
  -- so the admin UI can group by resource without parsing strings.
  key text not null unique,
  resource text not null,
  action text not null,
  description text,

  created_at timestamptz not null default now(),

  constraint permissions_key_shape check (key = resource || '.' || action),
  constraint permissions_resource_format check (resource ~ '^[a-z][a-z0-9_]*$'),
  constraint permissions_action_format check (action ~ '^[a-z][a-z0-9_]*$')
);

comment on table public.permissions is
  'The complete vocabulary of privileged operations. Rows are added by migration, never at runtime.';

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- Composite primary key rather than a surrogate id: the pair *is* the
  -- identity, and this makes the duplicate-grant case impossible rather than
  -- merely unlikely.
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is
  'Which permissions each role carries. Cascades from both sides.';

-- The primary key already indexes (role_id, permission_id). This covers the
-- other direction: "which roles grant this permission", used when revoking a
-- capability globally.
create index idx_role_permissions_permission on public.role_permissions (permission_id);

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,

  primary key (user_id, role_id)
);

comment on table public.user_roles is
  'Role grants. A user with no rows here has no privileged access.';

-- "Who holds this role" — needed when auditing a role before changing it.
create index idx_user_roles_role on public.user_roles (role_id);

-- -----------------------------------------------------------------------------
-- admins
-- -----------------------------------------------------------------------------
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  -- One admin record per user. Unique rather than using user_id as the primary
  -- key so that audit rows can reference a stable admin id even if the design
  -- later allows an admin record to outlive its auth user.
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- Deactivation is the normal path for someone leaving: it revokes access
  -- immediately while keeping their name attached to everything they did.
  is_active boolean not null default true,
  job_title text,
  notes text,
  last_seen_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);

comment on table public.admins is
  'Staff register. Membership plus an active flag is what admin RLS checks; roles then decide what the admin may do.';

create trigger admins_set_updated_at
  before update on public.admins
  for each row execute function public.set_updated_at();
create trigger admins_set_row_actor
  before insert or update on public.admins
  for each row execute function public.set_row_actor();

-- Every privileged RLS check starts by asking "is this user an active admin".
-- That lookup happens on essentially every admin request, so it gets its own
-- covering partial index rather than relying on the unique constraint alone.
create index idx_admins_active_user on public.admins (user_id)
  where is_active and deleted_at is null;

-- -----------------------------------------------------------------------------
-- Authorisation helper functions
-- -----------------------------------------------------------------------------
-- These are the single implementation of "may this user do X". Policies call
-- them; nothing re-derives the logic inline.
--
-- SECURITY DEFINER is required, not a shortcut: a policy on user_roles that
-- queried user_roles would recurse infinitely. Running the lookup as the
-- function owner bypasses RLS on the tables it reads and breaks the cycle.
--
-- `set search_path = ''` is a security requirement, not style. Without it a
-- caller can prepend a schema to search_path and shadow `public.admins` with
-- their own table, and a SECURITY DEFINER function would then read it with
-- elevated rights. Every reference below is schema-qualified for that reason.
--
-- `(select auth.uid())` rather than bare `auth.uid()` lets the planner evaluate
-- it once as an InitPlan instead of once per row — the difference is large on
-- a 50,000-row scan.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
      and a.is_active
      and a.deleted_at is null
  );
$$;

comment on function public.is_admin() is
  'True when the caller is an active, non-deleted admin. Membership only — says nothing about what they may do.';

create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins a
    join public.user_roles ur on ur.user_id = a.user_id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where a.user_id = (select auth.uid())
      and a.is_active
      and a.deleted_at is null
      and p.key = permission_key
  );
$$;

comment on function public.has_permission(text) is
  'True when the caller is an active admin holding a role that grants the named permission.';

-- -----------------------------------------------------------------------------
-- Protect system roles and the permission vocabulary
-- -----------------------------------------------------------------------------
-- Application code branches on role keys such as super_admin. Renaming or
-- deleting one at runtime would silently change who can do what, so it is
-- refused at the table rather than merely discouraged in a comment.
create or replace function public.protect_system_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'role % is a system role and cannot be deleted', old.key
        using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if old.is_system and new.key is distinct from old.key then
    raise exception 'system role % cannot be renamed', old.key
      using errcode = 'restrict_violation';
  end if;
  if old.is_system and not new.is_system then
    raise exception 'role % cannot stop being a system role', old.key
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger roles_protect_system
  before update or delete on public.roles
  for each row execute function public.protect_system_roles();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Enabled in the same migration that creates each table, per the project's
-- standing rule. A table must never exist without policies, not even briefly.
--
-- Reminder for anyone reading a policy below: service_role bypasses RLS
-- entirely, so no policy grants it anything. It has full access by virtue of
-- being service_role, which is why supabase/admin.ts is guarded by
-- `server-only`.

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.admins enable row level security;

-- --- profiles ----------------------------------------------------------------
-- A customer reads and updates their own row and no other. This is the whole of
-- the customer's write surface in this schema.
create policy "profiles: owner reads own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner updates own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT policy: rows arrive through handle_new_user(), which runs as
-- SECURITY DEFINER. No DELETE policy: profiles die with their auth user.

-- Support staff need to look a customer up. Gated on an explicit permission
-- rather than on admin membership, so a warehouse role cannot read customers.
create policy "profiles: staff with users.read may read"
  on public.profiles for select
  to authenticated
  using (public.has_permission('users.read'));

create policy "profiles: staff with users.update may update"
  on public.profiles for update
  to authenticated
  using (public.has_permission('users.update'))
  with check (public.has_permission('users.update'));

-- --- roles / permissions / grants ---------------------------------------------
-- Readable by any admin, because the admin UI must render what a role is called
-- before it can ask whether you may change it. Writable only with roles.manage.
create policy "roles: admins read"
  on public.roles for select
  to authenticated
  using (public.is_admin());

create policy "roles: roles.manage writes"
  on public.roles for all
  to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "permissions: admins read"
  on public.permissions for select
  to authenticated
  using (public.is_admin());

-- permissions has no write policy at all. The vocabulary of what the system can
-- do is defined by migrations; inventing a permission at runtime would create a
-- key that no policy references and no code checks — an authorisation illusion.

create policy "role_permissions: admins read"
  on public.role_permissions for select
  to authenticated
  using (public.is_admin());

create policy "role_permissions: roles.manage writes"
  on public.role_permissions for all
  to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy "user_roles: admins read"
  on public.user_roles for select
  to authenticated
  using (public.is_admin());

create policy "user_roles: users.assign_roles writes"
  on public.user_roles for all
  to authenticated
  using (public.has_permission('users.assign_roles'))
  with check (public.has_permission('users.assign_roles'));

-- A user may see which roles they themselves hold, so the UI can render its
-- navigation without a privileged round trip.
create policy "user_roles: owner reads own grants"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()));

-- --- admins -------------------------------------------------------------------
create policy "admins: admins read"
  on public.admins for select
  to authenticated
  using (public.is_admin());

create policy "admins: admins.manage writes"
  on public.admins for all
  to authenticated
  using (public.has_permission('admins.manage'))
  with check (public.has_permission('admins.manage'));

-- =============================================================================
-- Permission vocabulary
-- =============================================================================
-- Defined here rather than in the seed because policies reference these keys by
-- name. A production database without them would have admins who can do
-- nothing, which is a broken deployment rather than an empty one.
insert into public.permissions (key, resource, action, description) values
  ('products.read',      'products',   'read',         'View products including drafts'),
  ('products.create',    'products',   'create',       'Create products'),
  ('products.update',    'products',   'update',       'Edit products'),
  ('products.delete',    'products',   'delete',       'Archive or soft-delete products'),
  ('categories.read',    'categories', 'read',         'View categories including hidden'),
  ('categories.manage',  'categories', 'manage',       'Create, edit and remove categories'),
  ('brands.read',        'brands',     'read',         'View brands including hidden'),
  ('brands.manage',      'brands',     'manage',       'Create, edit and remove brands'),
  ('inventory.read',     'inventory',  'read',         'View stock levels and movement history'),
  ('inventory.adjust',   'inventory',  'adjust',       'Record inventory movements'),
  ('banners.read',       'banners',    'read',         'View site banners including inactive'),
  ('banners.manage',     'banners',    'manage',       'Create, edit and remove site banners'),
  ('settings.read',      'settings',   'read',         'View all settings including private'),
  ('settings.update',    'settings',   'update',       'Change settings'),
  ('users.read',         'users',      'read',         'Look up customer profiles'),
  ('users.update',       'users',      'update',       'Edit customer profiles'),
  ('users.assign_roles', 'users',      'assign_roles', 'Grant and revoke roles'),
  ('admins.manage',      'admins',     'manage',       'Add, deactivate and edit admin records'),
  ('roles.manage',       'roles',      'manage',       'Create roles and change what they grant'),
  ('audit.read',         'audit',      'read',         'Read the audit log');

-- =============================================================================
-- System roles
-- =============================================================================
insert into public.roles (key, name, description, is_system) values
  ('super_admin',        'Super administrator', 'Unrestricted access to every capability.', true),
  ('catalog_manager',    'Catalog manager',     'Manages products, categories and brands.', true),
  ('inventory_manager',  'Inventory manager',   'Records stock movements and reads the catalog.', true),
  ('support_agent',      'Support agent',       'Reads customers and the catalog. Changes nothing.', true),
  ('content_editor',     'Content editor',      'Manages banners and public settings.', true);

-- super_admin holds every permission that exists. Written as a set-based insert
-- so that adding a permission in a later migration and re-running this pattern
-- keeps super_admin complete, rather than requiring someone to remember.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'super_admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = any (array[
  'products.read', 'products.create', 'products.update', 'products.delete',
  'categories.read', 'categories.manage',
  'brands.read', 'brands.manage',
  'inventory.read'
])
where r.key = 'catalog_manager';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = any (array[
  'products.read', 'inventory.read', 'inventory.adjust'
])
where r.key = 'inventory_manager';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = any (array[
  'products.read', 'categories.read', 'brands.read', 'inventory.read', 'users.read'
])
where r.key = 'support_agent';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = any (array[
  'banners.read', 'banners.manage', 'settings.read', 'settings.update'
])
where r.key = 'content_editor';
