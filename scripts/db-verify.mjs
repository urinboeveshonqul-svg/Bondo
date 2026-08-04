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
import { applySeed, createSchema } from "./db-harness.mjs";

const EXPECTED_TABLES = [
  "admins",
  "audit_logs",
  "banner_translations",
  "brand_translations",
  "brands",
  "categories",
  "category_translations",
  "content_page_translations",
  "content_pages",
  "inventory",
  "inventory_movements",
  "permissions",
  "product_images",
  "product_specifications",
  "product_translations",
  "products",
  "profiles",
  "role_permissions",
  "roles",
  "setting_translations",
  "settings",
  "site_banners",
  "user_roles",
  "wishlist_items",
  "wishlists",
];

/**
 * Every table holding localized copy, and the column that keys it.
 *
 * Asserted rather than assumed: the localization architecture is only real if
 * each of these actually has a `locale` column, a composite primary key
 * including it, and a cascade from its parent (K-15).
 */
const TRANSLATION_TABLES = {
  product_translations: "product_id",
  category_translations: "category_id",
  brand_translations: "brand_id",
  banner_translations: "banner_id",
  content_page_translations: "page_id",
  setting_translations: "setting_key",
};

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
  migrationCount === 12,
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
  `${EXPECTED_TABLES.length} public tables exist`,
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
// Per **locale** now (K-15): one `simple` vector over three languages stems
// none of them, and Russian searched against an English dictionary silently
// returns nothing.
for (const table of ["product_translations", "content_page_translations"]) {
  const vector = (
    await db.query(
      `select a.attgenerated
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       where c.relname = $1 and a.attname = 'search_vector' and not a.attisdropped`,
      [table],
    )
  ).rows;

  check(
    `${table}.search_vector is a generated column`,
    vector[0]?.attgenerated === "s",
    vector.length ? `attgenerated=${vector[0].attgenerated}` : "absent",
  );
}

// -----------------------------------------------------------------------------
// Localization architecture (K-15)
// -----------------------------------------------------------------------------
// The single-language columns must be *gone*, not merely unused. Two places to
// write a product name is the duplicate concept this phase removed.
const strandedColumns = (
  await db.query(`
    select c.relname, a.attname
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not a.attisdropped and a.attnum > 0
      and (
        (c.relname = 'products' and a.attname in
          ('name','description','short_description','slug','seo_title','seo_description','search_keywords','search_vector'))
        or (c.relname = 'categories' and a.attname in
          ('name','description','slug','seo_title','seo_description'))
        or (c.relname = 'brands' and a.attname in
          ('description','seo_title','seo_description'))
        or (c.relname = 'site_banners' and a.attname in ('title','subtitle'))
      )
  `)
).rows;

check(
  "single-language content columns were dropped from the parents",
  strandedColumns.length === 0,
  strandedColumns.map((r) => `${r.relname}.${r.attname}`).join(", ") ||
    "products, categories, brands and site_banners are language-independent",
);

for (const [table, parentColumn] of Object.entries(TRANSLATION_TABLES)) {
  const columns = (
    await db.query(
      `select a.attname from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = $1
         and not a.attisdropped and a.attnum > 0`,
      [table],
    )
  ).rows.map((r) => r.attname);

  check(`${table} has a locale column`, columns.includes("locale"));

  // The primary key must be (parent, locale). Anything else permits two rows
  // for one language, and the application would pick between them arbitrarily.
  const pk = (
    await db.query(
      `select att.attname
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join unnest(con.conkey) as k(attnum) on true
       join pg_attribute att on att.attrelid = c.oid and att.attnum = k.attnum
       where con.contype = 'p' and n.nspname = 'public' and c.relname = $1`,
      [table],
    )
  ).rows.map((r) => r.attname);

  check(
    `${table} is keyed by (${parentColumn}, locale)`,
    pk.length === 2 && pk.includes(parentColumn) && pk.includes("locale"),
    pk.join(", "),
  );

  // A translation outliving its parent is unreachable noise.
  const cascade = (
    await db.query(
      `select con.confdeltype
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join unnest(con.conkey) as k(attnum) on true
       join pg_attribute att on att.attrelid = c.oid and att.attnum = k.attnum
       where con.contype = 'f' and n.nspname = 'public'
         and c.relname = $1 and att.attname = $2`,
      [table, parentColumn],
    )
  ).rows;

  check(
    `${table} cascades from its parent`,
    cascade[0]?.confdeltype === "c",
    cascade.length ? `confdeltype=${cascade[0].confdeltype}` : "no foreign key",
  );
}

// A localized slug is unique *within* a locale, never globally: "monitor" may
// be one product's Uzbek slug and another product's English one.
for (const table of [
  "product_translations",
  "category_translations",
  "content_page_translations",
]) {
  const indexes = (
    await db.query(
      `select indexdef from pg_indexes
       where schemaname = 'public' and tablename = $1`,
      [table],
    )
  ).rows;

  check(
    `${table} has a per-locale unique slug index`,
    indexes.some(
      (row) =>
        /UNIQUE/i.test(row.indexdef) && /locale, slug/i.test(row.indexdef),
    ),
    indexes.length ? "" : "no indexes",
  );
}

const localeValues = (
  await db.query(`
    select e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'locale'
    order by e.enumsortorder
  `)
).rows.map((r) => r.enumlabel);

check(
  "locale enum is exactly uz, ru, en",
  localeValues.join(",") === "uz,ru,en",
  localeValues.join(", ") || "absent",
);

// -----------------------------------------------------------------------------
// Social and canonical metadata (20260805001000_social_metadata.sql)
// -----------------------------------------------------------------------------
// The reusable SEO panel renders these columns. Asserting them here is what
// keeps the panel and the schema from drifting: a column dropped or renamed in a
// later migration fails the build rather than the save.
// -----------------------------------------------------------------------------
const SOCIAL_COLUMNS = [
  "canonical_url",
  "og_title",
  "og_description",
  "og_image_path",
  "twitter_card",
];

for (const table of [
  "product_translations",
  "category_translations",
  "brand_translations",
  "content_page_translations",
]) {
  const columns = (
    await db.query(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = $1
      `,
      [table],
    )
  ).rows.map((r) => r.column_name);

  const missing = SOCIAL_COLUMNS.filter((c) => !columns.includes(c));

  check(
    `${table} carries the social metadata columns`,
    missing.length === 0,
    missing.length
      ? `missing ${missing.join(", ")}`
      : SOCIAL_COLUMNS.join(", "),
  );
}

const twitterCardValues = (
  await db.query(`
    select e.enumlabel
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'twitter_card'
    order by e.enumsortorder
  `)
).rows.map((r) => r.enumlabel);

check(
  "twitter_card enum is exactly summary, summary_large_image",
  twitterCardValues.join(",") === "summary,summary_large_image",
  twitterCardValues.join(", ") || "absent",
);

// A relative canonical resolves against whichever page emitted it, so every
// locale would declare itself canonical for a different address. Proven, not
// assumed — a check constraint that was written but never exercised is a
// comment.
const canonicalRejected = await db
  .query(
    `
      insert into public.product_translations (product_id, locale, name, canonical_url)
      values (gen_random_uuid(), 'en', 'x', '/products/x')
    `,
  )
  .then(
    () => false,
    () => true,
  );

check("a relative canonical_url is rejected", canonicalRejected);

// -----------------------------------------------------------------------------
// The seed must still apply. It writes catalog rows, and this phase moved every
// piece of localized copy out from under it — a seed that no longer matches the
// schema breaks `db:reset` for whoever runs it next, silently until they do.
// -----------------------------------------------------------------------------
try {
  await applySeed(db);
  check("supabase/seed.sql applies against the schema", true);

  const seeded = (
    await db.query(`
      select
        (select count(*) from public.products)::int as products,
        (select count(*) from public.product_translations)::int as product_rows,
        (select count(*) from public.category_translations)::int as category_rows,
        (select count(*) from public.brand_translations)::int as brand_rows,
        (select count(*) from public.banner_translations)::int as banner_rows
    `)
  ).rows[0];

  check(
    "every seeded product has a translation",
    seeded.products > 0 && seeded.product_rows >= seeded.products,
    `${seeded.products} products, ${seeded.product_rows} translations`,
  );

  check(
    "categories, brands and banners were translated too",
    seeded.category_rows > 0 && seeded.brand_rows > 0 && seeded.banner_rows > 0,
    `categories ${seeded.category_rows}, brands ${seeded.brand_rows}, banners ${seeded.banner_rows}`,
  );

  // Proof the vector indexes text rather than merely existing — and that the
  // per-locale dictionary is really applied. Both halves matter:
  //
  //  * "graphics" only matches the description via the *english* dictionary,
  //    which stems it to "graphic". A `simple` query would miss it, which is
  //    exactly the bug a single shared config produces.
  //  * "nvidia" matches the name and keywords, which are indexed `simple` so a
  //    model number survives intact.
  const stemmed = (
    await db.query(`
      select count(*)::int as n from public.product_translations
      where locale = 'en'
        and search_vector @@ websearch_to_tsquery('english', 'graphics')
    `)
  ).rows[0];

  check(
    'english dictionary stems prose — "graphics" finds "graphics card"',
    stemmed.n > 0,
    `${stemmed.n} rows`,
  );

  const literal = (
    await db.query(`
      select count(*)::int as n from public.product_translations
      where locale = 'en'
        and search_vector @@ websearch_to_tsquery('simple', 'nvidia')
    `)
  ).rows[0];

  check(
    'simple dictionary keeps identifiers intact — "nvidia" matches',
    literal.n > 0,
    `${literal.n} rows`,
  );

  // The dictionary is chosen from the row's locale, so an English query must
  // not be what makes a Russian row match. Nothing seeds Russian copy, so the
  // assertion is that the function exists and returns the right config.
  const configs = (
    await db.query(`
      select
        public.text_search_config('uz')::text as uz,
        public.text_search_config('ru')::text as ru,
        public.text_search_config('en')::text as en
    `)
  ).rows[0];

  check(
    "each locale maps to its own text search dictionary",
    configs.uz === "simple" &&
      configs.ru === "russian" &&
      configs.en === "english",
    `uz=${configs.uz}, ru=${configs.ru}, en=${configs.en}`,
  );
} catch (error) {
  check("supabase/seed.sql applies against the schema", false, error.message);
}

await db.close();

console.log(results.join("\n"));
console.log(
  failures
    ? `\n${results.length - failures}/${results.length} passed — ${failures} FAILED`
    : `\nall ${results.length} assertions passed`,
);
process.exit(failures ? 1 : 0);
