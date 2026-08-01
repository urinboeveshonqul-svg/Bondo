-- =============================================================================
-- Table and function grants
-- =============================================================================
-- Postgres access control is two independent gates, and BOTH must open:
--
--   GRANT  may this role touch this table at all?
--   RLS    which rows, and under what conditions?
--
-- Supabase configures default privileges that grant new public tables to
-- anon/authenticated automatically, so these statements are partly redundant on
-- a hosted project. They are written out anyway because a privilege model that
-- exists only as a platform default is a privilege model nobody can review. An
-- engineer asking "can anonymous users reach audit_logs?" should find the answer
-- in this file, not in a Supabase changelog.
--
-- The rule applied below: anon is granted SELECT only on tables that actually
-- have an anonymous read policy. Granting more and relying on RLS alone would
-- work, but it removes the second gate for no benefit — and the second gate is
-- what saves you when a policy is written wrong.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- anon: read-only, and only the public catalog surface
-- -----------------------------------------------------------------------------
grant select on table
  public.products,
  public.product_images,
  public.product_specifications,
  public.categories,
  public.brands,
  public.settings,
  public.site_banners
to anon;

-- Deliberately NOT granted to anon: profiles, admins, roles, permissions,
-- role_permissions, user_roles, inventory, inventory_movements, audit_logs,
-- wishlists, wishlist_items. Each is also denied by RLS; the missing grant is
-- the belt to that pair of braces.

-- -----------------------------------------------------------------------------
-- authenticated: DML on everything RLS might let them touch
-- -----------------------------------------------------------------------------
-- Broad here because "which authenticated users" is precisely the question RLS
-- answers, and answering it twice in two places is how the two answers end up
-- disagreeing. A customer holds no permissions, so every admin-only policy
-- evaluates false for them regardless of this grant.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Except the two append-only tables, where UPDATE and DELETE are meaningless.
-- The triggers already refuse them; revoking the privilege means the request is
-- rejected before a trigger has to run, and makes the intent visible in \dp.
revoke update, delete on table public.inventory_movements from authenticated;
revoke update, delete on table public.audit_logs from authenticated;

-- permissions is a fixed vocabulary defined by migrations (see the note in
-- 20260801000200). No runtime writes, by anyone.
revoke insert, update, delete on table public.permissions from authenticated;

-- -----------------------------------------------------------------------------
-- service_role: everything, because it bypasses RLS by design
-- -----------------------------------------------------------------------------
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------
-- Policy expressions are evaluated as the querying role, so that role needs
-- EXECUTE on every function a policy calls. Postgres grants EXECUTE to PUBLIC
-- by default, which makes these lines redundant today — and load-bearing the
-- moment anyone hardens the database by revoking that default.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_product_published(uuid) to anon, authenticated;
grant execute on function public.is_valid_slug(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Future tables
-- -----------------------------------------------------------------------------
-- Later phases add tables (carts, orders, reviews). Without default privileges
-- they would be unreachable by the application until someone remembered to
-- grant them — a failure that looks like a mysterious permission error rather
-- than a missing line of SQL.
--
-- anon is deliberately absent: a new table should not become world-readable
-- because someone created it. Phase 3+ grants anon explicitly, per table, in
-- the migration that adds an anonymous read policy for it.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
