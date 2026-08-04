/**
 * A Docker-free Postgres carrying this project's real schema.
 *
 * `supabase db start` needs Docker, and this machine has none (**K-3**). PGlite
 * is Postgres compiled to WebAssembly, so it runs in-process — enough to apply
 * every migration and then be introspected exactly as a real database would be.
 *
 * Two things use it:
 *
 *  - `npm run db:verify` asserts the schema is what the migrations say it is.
 *  - `npm run db:types` points the **official** Supabase generator at it over
 *    the Postgres wire protocol, so `types/database.ts` is generated output and
 *    not hand-written.
 *
 * **What this is not.** It is not Supabase. `auth`, `storage` and the platform
 * roles are stubbed below to the shape the migrations depend on, and nothing
 * here proves GoTrue accepts the seed's `auth.users` inserts (**K-9**) or that
 * `storage.objects` RLS behaves at runtime (**K-8**). What it does prove is the
 * `public` schema, which is entirely defined by the SQL in this repository —
 * and that is exactly the part `--schema public` generates types for.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../supabase/migrations/", import.meta.url),
);

/**
 * The Supabase platform objects the migrations reference.
 *
 * Derived from the migrations rather than guessed: `auth.users`, `auth.uid()`,
 * `storage.objects`, `storage.buckets`, `storage.foldername()`, the
 * `extensions` schema, and the four platform roles. Each is stubbed to the
 * signature the SQL actually uses, so a migration that starts depending on
 * something new fails here loudly instead of silently diverging from hosted
 * Supabase.
 */
const PLATFORM_STUBS = /* sql */ `
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists extensions;

  -- Roles. Supabase creates these; RLS policies and GRANTs name them.
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
      create role supabase_auth_admin nologin noinherit;
    end if;
  end
  $$;

  -- Only the columns the migrations reference. A wider stub would invite the
  -- schema to depend on a column hosted Supabase might not have.
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb,
    created_at timestamptz not null default now()
  );

  create table if not exists auth.identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    provider text not null,
    identity_data jsonb not null,
    created_at timestamptz not null default now()
  );

  -- Reads the request's JWT claim. Stubbed to a transaction-local GUC so tests
  -- can impersonate a user with \`set local request.jwt.claim.sub\`.
  create or replace function auth.uid()
  returns uuid
  language sql stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create or replace function auth.role()
  returns text
  language sql stable
  as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
  $$;

  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz not null default now()
  );

  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid references auth.users (id),
    metadata jsonb,
    created_at timestamptz not null default now()
  );

  -- Splits an object key into path segments; policies use foldername(name)[1]
  -- to scope a file to its owner's folder.
  create or replace function storage.foldername(name text)
  returns text[]
  language sql immutable
  as $$
    select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/');
  $$;
`;

/** Boots PGlite, stubs the platform, and applies every migration in order. */
export async function createSchema({ log = false } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.waitReady;

  await db.exec(PLATFORM_STUBS);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

    try {
      await db.exec(sql);
      if (log) console.log(`  applied ${file}`);
    } catch (error) {
      throw new Error(`Migration failed: ${file}\n  ${error.message}`, {
        cause: error,
      });
    }
  }

  return { db, migrationCount: files.length };
}
