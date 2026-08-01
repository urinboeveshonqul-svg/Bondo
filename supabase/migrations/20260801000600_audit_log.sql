-- =============================================================================
-- Audit log
-- =============================================================================
-- Append-only record of privileged actions. Two properties make it worth
-- having, and both are enforced rather than assumed:
--
--   1. It cannot be edited. A trigger rejects UPDATE and DELETE for every role
--      including service_role, because an audit log an attacker with the
--      service key can rewrite is not evidence of anything.
--   2. It survives its subject. actor_id is ON DELETE SET NULL and the actor's
--      email is copied in at write time, so deleting a user account does not
--      erase what that account did.
--
-- Rows are written by the application (Phase 6) rather than by table triggers.
-- A trigger cannot see intent — it records that a column changed, not that "an
-- admin refunded this order because the customer called". Intent is the part
-- worth auditing.
-- =============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  actor_id uuid references auth.users (id) on delete set null,
  -- Denormalised on purpose: the log must remain readable after the account is
  -- gone, which is exactly when someone is reading it.
  actor_email text,

  -- Verb, e.g. product.updated, role.granted, inventory.adjusted. Free text
  -- rather than an enum: an enum would need a migration every time a new
  -- auditable action ships, and the pressure to skip that migration is how
  -- actions end up unaudited.
  action text not null,

  resource_type text not null,
  -- Nullable: some actions have no single subject (a bulk import, a login).
  resource_id uuid,

  -- Before/after or a description of the change. jsonb so a specific field can
  -- be queried later without reparsing text.
  changes jsonb,
  -- Anything else worth keeping: request id, reason given, batch size.
  metadata jsonb,

  ip_address inet,
  user_agent text,

  created_at timestamptz not null default now(),

  constraint audit_logs_action_format check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint audit_logs_resource_type_format check (resource_type ~ '^[a-z][a-z0-9_]*$'),
  constraint audit_logs_user_agent_length check (
    user_agent is null or char_length(user_agent) <= 1000
  )
);

comment on table public.audit_logs is
  'Append-only log of privileged actions. Immutable for every role; written by the application, not by table triggers.';
comment on column public.audit_logs.actor_email is
  'Copied at write time so the entry stays meaningful after the account is deleted.';

-- "What happened to this product?" — the timeline for one resource.
create index idx_audit_logs_resource
  on public.audit_logs (resource_type, resource_id, created_at desc);

-- "What has this admin been doing?" — the review that follows an incident.
create index idx_audit_logs_actor
  on public.audit_logs (actor_id, created_at desc);

-- The unfiltered recent feed on the audit screen.
create index idx_audit_logs_recent
  on public.audit_logs (created_at desc);

-- Reuses the append-only trigger defined with the inventory ledger. One
-- implementation, two tables — the alternative is two copies of the same
-- function drifting apart.
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.reject_ledger_mutation();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.audit_logs enable row level security;

create policy "audit_logs: audit.read views the log"
  on public.audit_logs for select
  to authenticated
  using (public.has_permission('audit.read'));

-- Any admin may write an entry — every privileged action they take should
-- produce one, and gating writes behind a permission would mean an admin
-- lacking it acts unaudited. Reading is the restricted operation, not writing.
create policy "audit_logs: admins append"
  on public.audit_logs for insert
  to authenticated
  with check (public.is_admin());

-- No UPDATE or DELETE policy, and the trigger above blocks both regardless.
-- Retention is a Phase 9 concern and will be a scheduled job running as a role
-- explicitly exempted from that trigger, not an ad-hoc DELETE.
