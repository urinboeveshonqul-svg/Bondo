-- =============================================================================
-- The audit log outlives its actors
-- =============================================================================
-- **Deleting any user who had ever written an audit entry was impossible.**
--
-- `audit_logs.actor_id` referenced `auth.users` with `on delete set null`, and
-- `audit_logs` carries a `before update or delete` trigger that rejects every
-- mutation (ADR-27). Those two are incompatible: the cascade tries to UPDATE the
-- audit row to null the actor, the append-only guard raises, and the entire
-- `DELETE FROM auth.users` is rolled back.
--
-- It surfaced as an opaque `500` from GoTrue with an empty body — no constraint
-- name, no table, nothing pointing at the audit log. Found by trying to delete
-- the bootstrap administrator and isolating it against test users that deleted
-- cleanly, the difference between them being exactly one audit row.
--
-- Every administrator writes audit entries by definition, so this locked the
-- entire staff register permanently, and it would have locked any customer the
-- moment audit coverage extended to customer actions.
--
-- -----------------------------------------------------------------------------
-- The fix: drop the foreign key, not the guard
-- -----------------------------------------------------------------------------
-- Weakening the append-only trigger to permit "an update that only nulls
-- actor_id" was the other option, and it is the wrong one twice over. It puts a
-- hole in the guarantee ADR-27 exists to make absolute — one exception is how a
-- log stops being evidence — and it *erases the actor*, which is the single most
-- important field in the row. An audit entry whose actor disappears when the
-- account is closed is an audit entry that cannot answer the only question ever
-- asked of it.
--
-- So the log stops depending on `auth.users` instead. `actor_id` stays a `uuid`
-- and keeps pointing at whoever acted, and `actor_email` — already on the table
-- since the original migration — carries the human-readable identity that
-- survives regardless. This is the usual shape for an audit log: it records what
-- happened, and history does not change because somebody left.
--
-- **This does not make erasure impossible.** Redacting a person from the log is
-- now a deliberate operation someone performs on purpose, rather than a silent
-- side effect of closing an account — which is what a data-protection request
-- actually calls for.
-- =============================================================================

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

comment on column public.audit_logs.actor_id is
  'Who acted. Intentionally NOT a foreign key: the log outlives the account, and the append-only guard (ADR-27) makes any cascade impossible. Pair with actor_email, which survives independently.';

-- Still indexed: "everything this person did" is the query an audit log exists
-- to answer, and dropping the constraint does not drop the index — but this
-- states the dependency so a future migration does not remove it as unused.
create index if not exists idx_audit_logs_actor_id
  on public.audit_logs (actor_id);
