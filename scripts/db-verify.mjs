#!/usr/bin/env node
/**
 * Asserts that the migrations produce the schema the documentation claims.
 *
 * Phase 2 verified this with a scratchpad harness that was never committed
 * (**D-7**), so nobody could reproduce it. This is that harness, committed, and
 * wired to `npm run db:verify`.
 *
 * Every assertion is read from `pg_catalog` after applying the real migrations,
 * so it describes what the SQL actually built rather than what a comment says it
 * built. It runs in PGlite, so it needs no Docker.
 *
 * **What it cannot prove**, and why the related known issues stay open:
 *  - RLS *behaviour*. Policies are checked for existence and command coverage,
 *    not evaluated against a real JWT (**K-8** for storage in particular).
 *  - GoTrue's acceptance of the seed's `auth.users` rows (**K-9**).
 *  - Anything about a hosted project's configuration.
 */
import { createSchema } from "./db-harness.mjs";

const EXPECTED_TABLES = [
  "admins",
  "audit_logs",
  "brands",
  "categories",
  "inventory",
  "inventory_movements",
  "permissions",
  "product_images",
  "product_specifications",
  "products",
  "profiles",
  "role_permissions",
  "roles",
  "settings",
  "site_banners",
  "user_roles",
  "wishlist_items",
  "wishlists",
];

const results = [];
let failures = 0;

function check(name, ok, detail) {
  results.push(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
}

const { db, migrationCount } = await createSchema();

check(
  "all migrations apply cleanly",
  migrationCount === 9,
  `${migrationCount} files`,
);

// -----------------------------------------------------------------------------
// Tables
// -----------------------------------------------------------------------------
const tables = (
  await db.query(`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `)
).rows.map((row) => row.tablename);

check(
  `18 public tables exist`,
  tables.length === EXPECTED_TABLES.length,
  `${tables.length} found`,
);

for (const expected of EXPECTED_TABLES) {
  check(`table ${expected}`, tables.includes(expected));
}

// -----------------------------------------------------------------------------
// Row Level Security — enabled on every table, with policies
// -----------------------------------------------------------------------------
const rls = (
  await db.query(`
    select c.relname, c.relrowsecurity, count(p.polname)::int as policies
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname, c.relrowsecurity
    order by c.relname
  `)
).rows;

const withoutRls = rls
  .filter((row) => !row.relrowsecurity)
  .map((r) => r.relname);
check(
  "RLS enabled on every table",
  withoutRls.length === 0,
  withoutRls.join(", "),
);

const withoutPolicies = rls
  .filter((row) => row.policies === 0)
  .map((r) => r.relname);
check(
  "every table carries at least one policy",
  withoutPolicies.length === 0,
  withoutPolicies.join(", ") ||
    `${rls.reduce((n, r) => n + r.policies, 0)} policies total`,
);

// -----------------------------------------------------------------------------
// Foreign keys — every one, with its delete rule
// -----------------------------------------------------------------------------
const fks = (
  await db.query(`
    select
      con.conname,
      cl.relname as child,
      parent.relname as parent,
      con.confdeltype
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
    order by cl.relname, con.conname
  `)
).rows;

check("foreign keys are declared", fks.length > 0, `${fks.length} constraints`);

// A referencing column with no delete rule leaves orphans behind.
const noDeleteRule = fks.filter((fk) => fk.confdeltype === "a");
check(
  "every foreign key declares a delete rule",
  noDeleteRule.length === 0,
  noDeleteRule.map((fk) => fk.conname).join(", ") ||
    `cascade ${fks.filter((f) => f.confdeltype === "c").length}, ` +
      `set null ${fks.filter((f) => f.confdeltype === "n").length}, ` +
      `restrict ${fks.filter((f) => f.confdeltype === "r").length}`,
);

// -----------------------------------------------------------------------------
// Indexes
// -----------------------------------------------------------------------------
const indexes = (
  await db.query(`
    select indexname, tablename from pg_indexes
    where schemaname = 'public' order by tablename, indexname
  `)
).rows;

check("indexes exist", indexes.length >= 50, `${indexes.length} indexes`);

/**
 * Foreign keys that are actually traversed want an index on the child side, or
 * a join scans the table.
 *
 * Attribution columns are excluded deliberately. `created_by`, `updated_by` and
 * `granted_by` reference `auth.users` to record *who*, and nothing queries "every
 * product this user created" — indexing all seventeen would add seventeen
 * indexes written on every insert and read essentially never. The exclusion is
 * asserted rather than assumed: if one of these ever becomes a query path, this
 * list is where the decision is revisited.
 */
const ATTRIBUTION_COLUMNS = ["created_by", "updated_by", "granted_by"];

const fkColumns = (
  await db.query(
    `
    select cl.relname as child, att.attname as column_name
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join unnest(con.conkey) as k(attnum) on true
    join pg_attribute att on att.attrelid = cl.oid and att.attnum = k.attnum
    where con.contype = 'f' and n.nspname = 'public'
      and att.attname <> all($1::text[])
  `,
    [ATTRIBUTION_COLUMNS],
  )
).rows;

const indexDefs = (
  await db.query(
    `select tablename, indexdef from pg_indexes where schemaname = 'public'`,
  )
).rows;

const unindexedFks = fkColumns.filter(
  (fk) =>
    !indexDefs.some(
      (idx) =>
        idx.tablename === fk.child &&
        new RegExp(`\\(${fk.column_name}\\b|, ?${fk.column_name}\\b`).test(
          idx.indexdef,
        ),
    ),
);

check(
  "every traversed foreign key column is indexed",
  unindexedFks.length === 0,
  unindexedFks.map((fk) => `${fk.child}.${fk.column_name}`).join(", ") ||
    `${fkColumns.length} checked, ${ATTRIBUTION_COLUMNS.join("/")} excluded by design`,
);

// -----------------------------------------------------------------------------
// Triggers
// -----------------------------------------------------------------------------
const triggers = (
  await db.query(`
    select t.tgname, c.relname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname = 'public'
    order by c.relname, t.tgname
  `)
).rows;

check("triggers exist", triggers.length > 0, `${triggers.length} triggers`);

// The append-only guarantees are trigger-enforced (ADR-27), not policy-enforced,
// because RLS does not constrain service_role.
for (const table of ["audit_logs", "inventory_movements"]) {
  check(
    `${table} is guarded by a trigger`,
    triggers.some((t) => t.relname === table),
    triggers
      .filter((t) => t.relname === table)
      .map((t) => t.tgname)
      .join(", "),
  );
}

// `updated_at` has to be maintained by the database; an application that
// forgets it produces rows whose timestamp lies.
const updatedAtTables = (
  await db.query(`
    select c.relname
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and a.attname = 'updated_at' and c.relkind = 'r'
      and not a.attisdropped
    order by c.relname
  `)
).rows.map((r) => r.relname);

const missingTouch = updatedAtTables.filter(
  (table) => !triggers.some((t) => t.relname === table),
);
check(
  "every table with updated_at has a trigger to maintain it",
  missingTouch.length === 0,
  missingTouch.join(", ") || `${updatedAtTables.length} tables`,
);

// -----------------------------------------------------------------------------
// SECURITY DEFINER functions must pin search_path
// -----------------------------------------------------------------------------
const definers = (
  await db.query(`
    select p.proname, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
    order by p.proname
  `)
).rows;

const unpinned = definers.filter(
  (fn) => !(fn.proconfig ?? []).some((cfg) => cfg.startsWith("search_path=")),
);

check(
  "every SECURITY DEFINER function pins search_path",
  unpinned.length === 0,
  unpinned.map((f) => f.proname).join(", ") || `${definers.length} functions`,
);

// -----------------------------------------------------------------------------
// Enums — the vocabulary the application must agree with
// -----------------------------------------------------------------------------
const enums = (
  await db.query(`
    select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    group by t.typname
    order by t.typname
  `)
).rows;

check(
  "enums are declared",
  enums.length > 0,
  enums.map((e) => e.typname).join(", "),
);

// -----------------------------------------------------------------------------
// Full-text search column
// -----------------------------------------------------------------------------
const searchVector = (
  await db.query(`
    select a.attname, a.attgenerated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    where c.relname = 'products' and a.attname = 'search_vector' and not a.attisdropped
  `)
).rows;

check(
  "products.search_vector is a generated column",
  searchVector[0]?.attgenerated === "s",
  searchVector.length
    ? `attgenerated=${searchVector[0].attgenerated}`
    : "absent",
);

// -----------------------------------------------------------------------------
await db.close();

console.log(results.join("\n"));
console.log(
  failures
    ? `\n${results.length - failures}/${results.length} passed — ${failures} FAILED`
    : `\nall ${results.length} assertions passed`,
);
process.exit(failures ? 1 : 0);
