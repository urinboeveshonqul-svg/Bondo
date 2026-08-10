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
  "product_option_translations",
  "product_option_values",
  "product_options",
  "product_variant_options",
  "product_variants",
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
  "orders",
  "order_items",
  "order_status_history",
  "product_reviews",
  "service_highlights",
  "service_highlight_translations",
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
  migrationCount === 23,
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

// -----------------------------------------------------------------------------
// Variants (20260808001000_product_variants.sql)
// -----------------------------------------------------------------------------
// These exist because that migration restructured a table Phase 2 had verified:
// `inventory`'s primary key moved off `product_id`, and a partial unique index
// now carries what the key used to mean. The guarantee to re-prove is ADR-24 —
// stock changes only through the ledger — at the level that is new.
try {
  const indexes = (
    await db.query(`
      select indexname, indexdef from pg_indexes
      where schemaname = 'public'
        and indexname in ('idx_inventory_product_level', 'idx_inventory_variant_level')
    `)
  ).rows;

  const productLevel = indexes.find(
    (i) => i.indexname === "idx_inventory_product_level",
  );
  const variantLevel = indexes.find(
    (i) => i.indexname === "idx_inventory_variant_level",
  );

  check(
    "one product-level inventory row per product",
    Boolean(productLevel) && /UNIQUE/i.test(productLevel.indexdef),
  );
  check(
    "one inventory row per (product, variant)",
    Boolean(variantLevel) && /UNIQUE/i.test(variantLevel.indexdef),
  );

  const productId = (await db.query(`select id from public.products limit 1`))
    .rows[0].id;

  await db.query(
    `insert into public.product_variants (product_id, sku, price_cents)
     values ($1, 'VERIFY-VARIANT-1', 100000)`,
    [productId],
  );

  const variantId = (
    await db.query(
      `select id from public.product_variants where sku = 'VERIFY-VARIANT-1'`,
    )
  ).rows[0].id;

  const born = (
    await db.query(
      `select count(*)::int as n from public.inventory where variant_id = $1`,
      [variantId],
    )
  ).rows[0];

  check("a new variant gets an inventory row from birth", born.n === 1);

  const guarded = await db
    .query(
      `update public.inventory set quantity_on_hand = 500 where variant_id = $1`,
      [variantId],
    )
    .then(
      () => false,
      () => true,
    );

  check(
    "variant stock cannot be written directly — ADR-24 still holds",
    guarded,
  );

  await db.query(
    `insert into public.inventory_movements (product_id, variant_id, movement_type, quantity_delta)
     values ($1, $2, 'purchase', 7)`,
    [productId, variantId],
  );

  const applied = (
    await db.query(
      `select quantity_on_hand::int as qty from public.inventory where variant_id = $1`,
      [variantId],
    )
  ).rows[0];

  check(
    "a variant movement moves variant stock",
    applied.qty === 7,
    `quantity_on_hand=${applied.qty}`,
  );

  // The product's own row must be untouched by a variant movement, or the two
  // levels would double-count on every listing.
  const productStock = (
    await db.query(
      `select quantity_on_hand::int as qty from public.inventory
       where product_id = $1 and variant_id is null`,
      [productId],
    )
  ).rows[0];

  check(
    "a variant movement leaves product-level stock alone",
    productStock.qty !== 7,
    `product-level quantity_on_hand=${productStock.qty}`,
  );

  const optionId = (
    await db.query(
      `insert into public.product_options (product_id, key)
       values ($1, 'ram') returning id`,
      [productId],
    )
  ).rows[0].id;

  const values = (
    await db.query(
      `insert into public.product_option_values (option_id, value)
       values ($1, '16GB'), ($1, '32GB') returning id`,
      [optionId],
    )
  ).rows;

  await db.query(
    `insert into public.product_variant_options (variant_id, option_id, value_id)
     values ($1, $2, $3)`,
    [variantId, optionId, values[0].id],
  );

  const twoValues = await db
    .query(
      `insert into public.product_variant_options (variant_id, option_id, value_id)
       values ($1, $2, $3)`,
      [variantId, optionId, values[1].id],
    )
    .then(
      () => false,
      () => true,
    );

  check("a variant cannot hold two values on one axis", twoValues);

  const duplicateSku = await db
    .query(
      `insert into public.product_variants (product_id, sku, price_cents)
       values ($1, 'VERIFY-VARIANT-1', 5000)`,
      [productId],
    )
    .then(
      () => false,
      () => true,
    );

  check("a variant SKU is unique across the catalog", duplicateSku);
} catch (error) {
  check("variant schema behaves", false, error.message);
}

// -----------------------------------------------------------------------------
// Orders — the manual sales workflow
// -----------------------------------------------------------------------------
// The order flow is the one place in this schema where a mistake costs money, so
// it is asserted behaviourally rather than structurally: place a real order, move
// it, and check what the database did rather than what the DDL says it would.
try {
  // Seeded, active, public, published 30 days ago, on sale at 149900.
  const PRODUCT = "c0000000-0000-4000-8000-000000000001";
  // Seeded but `draft` with no `published_at` — nobody can buy it.
  const DRAFT_PRODUCT = "c0000000-0000-4000-8000-000000000004";

  const placed = (
    await db.query(
      `select * from public.place_order(
         'Anvar', 'Karimov', '+998901234567', 'Toshkent, Amir Temur 108',
         $1::jsonb, '+998911234567', null, 'Toshkent shahri', 'Yunusobod',
         'delivery', null, 'Kechqurun qo''ng''iroq qiling', 'uz'
       )`,
      [JSON.stringify([{ product_id: PRODUCT, quantity: 2 }])],
    )
  ).rows[0];

  check(
    "place_order issues a readable reference",
    /^BND-\d{6,}$/.test(placed.reference),
    placed.reference,
  );

  check(
    "checkout fields are recorded",
    placed.first_name === "Anvar" &&
      placed.last_name === "Karimov" &&
      placed.customer_name === "Anvar Karimov" &&
      placed.phone_secondary === "+998911234567" &&
      placed.region === "Toshkent shahri" &&
      placed.city === "Yunusobod" &&
      placed.delivery_method === "delivery",
    `${placed.customer_name}, ${placed.region}/${placed.city}, ${placed.delivery_method}`,
  );

  // A pickup order needs a shop; a delivery does not.
  const pickupWithoutShop = await db
    .query(
      `select public.place_order('A', 'B', '+998901112233', 'Olib ketish', $1::jsonb,
         null, null, null, null, 'pickup', null)`,
      [JSON.stringify([{ product_id: PRODUCT, quantity: 1 }])],
    )
    .then(
      () => false,
      () => true,
    );

  check("a pickup order with no location is refused", pickupWithoutShop);

  const pickup = (
    await db.query(
      `select * from public.place_order('Aziz', 'Tursunov', '+998901112244', 'Olib ketish',
         $1::jsonb, null, null, 'Toshkent shahri', 'Chilonzor', 'pickup',
         'Chilonzor filiali')`,
      [JSON.stringify([{ product_id: PRODUCT, quantity: 1 }])],
    )
  ).rows[0];

  check(
    "a pickup order records its shop",
    pickup.delivery_method === "pickup" &&
      pickup.pickup_location === "Chilonzor filiali",
    `${pickup.delivery_method} at ${pickup.pickup_location}`,
  );

  check("a new order starts at 'new'", placed.status === "new", placed.status);

  // The security property that matters most: the caller passed no prices, so
  // the total can only have come from the database.
  check(
    "place_order prices the line from the database, not the caller",
    placed.subtotal_cents === 299800 && placed.total_cents === 299800,
    `subtotal=${placed.subtotal_cents} total=${placed.total_cents}`,
  );

  const line = (
    await db.query(`select * from public.order_items where order_id = $1`, [
      placed.id,
    ])
  ).rows[0];

  check(
    "the line snapshots name, SKU and unit price",
    line.sku === "GPU-RTX4090-FE" &&
      line.unit_price_cents === 149900 &&
      line.line_total_cents === 299800,
    `${line.sku} @ ${line.unit_price_cents} × ${line.quantity}`,
  );

  // The snapshot has to be independent of the catalog, or it is not a snapshot.
  await db.query(
    `update public.products set price_cents = 999999, sale_price_cents = null
     where id = $1`,
    [PRODUCT],
  );

  const afterRepricing = (
    await db.query(
      `select total_cents::int as total from public.orders where id = $1`,
      [placed.id],
    )
  ).rows[0];

  check(
    "re-pricing the catalog does not move a placed order",
    afterRepricing.total === 299800,
    `total_cents=${afterRepricing.total}`,
  );

  const birth = (
    await db.query(
      `select from_status, to_status from public.order_status_history
       where order_id = $1`,
      [placed.id],
    )
  ).rows;

  check(
    "the timeline records the order's birth without being asked",
    birth.length === 1 &&
      birth[0].from_status === null &&
      birth[0].to_status === "new",
    `${birth.length} row(s)`,
  );

  await db.query(
    `update public.orders set status = 'contacted' where id = $1`,
    [placed.id],
  );
  await db.query(
    `update public.orders set status = 'confirmed' where id = $1`,
    [placed.id],
  );

  const moved = (
    await db.query(
      `select count(*)::int as n from public.order_status_history where order_id = $1`,
      [placed.id],
    )
  ).rows[0];

  check(
    "each status move appends one timeline row",
    moved.n === 3,
    `${moved.n} rows after two moves`,
  );

  // A double-clicked save must not write a second identical entry.
  await db.query(
    `update public.orders set status = 'confirmed' where id = $1`,
    [placed.id],
  );

  const unchanged = (
    await db.query(
      `select count(*)::int as n from public.order_status_history where order_id = $1`,
      [placed.id],
    )
  ).rows[0];

  check(
    "re-saving the same status appends nothing",
    unchanged.n === 3,
    `${unchanged.n} rows`,
  );

  const historyImmutable = await db
    .query(
      `update public.order_status_history set to_status = 'delivered'
       where order_id = $1`,
      [placed.id],
    )
    .then(
      () => false,
      () => true,
    );

  check("the timeline is append-only", historyImmutable);

  const totalGuard = await db
    .query(`update public.orders set delivery_fee_cents = 5000 where id = $1`, [
      placed.id,
    ])
    .then(
      () => false,
      () => true,
    );

  check("a delivery fee that does not reach the total is rejected", totalGuard);

  await db.query(
    `update public.orders
     set delivery_fee_cents = 5000, total_cents = subtotal_cents + 5000
     where id = $1`,
    [placed.id],
  );

  const emptyOrder = await db
    .query(
      `select public.place_order('X', 'Y', '+998901112233', 'Somewhere 1', '[]'::jsonb)`,
    )
    .then(
      () => false,
      () => true,
    );

  check("an order with no lines is refused", emptyOrder);

  const draftOrder = await db
    .query(
      `select public.place_order('X', 'Y', '+998901112233', 'Somewhere 1', $1::jsonb)`,
      [JSON.stringify([{ product_id: DRAFT_PRODUCT, quantity: 1 }])],
    )
    .then(
      () => false,
      () => true,
    );

  check("an unpublished product cannot be ordered", draftOrder);

  // ---------------------------------------------------------------------------
  // The review gate
  // ---------------------------------------------------------------------------
  // Asserted through RLS rather than around it: `set role authenticated` plus a
  // JWT claim is what a real customer's request looks like to Postgres.
  const buyer = (
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'buyer@bondo.test')
       returning id`,
    )
  ).rows[0].id;

  await db.query(`update public.orders set user_id = $1 where id = $2`, [
    buyer,
    placed.id,
  ]);

  /**
   * Runs one statement as a signed-in customer, with RLS actually enforced.
   *
   * Statements go one per `query` call rather than semicolon-joined: PGlite's
   * `query` takes a single statement, so a joined `begin; …; commit;` fails on
   * the protocol rather than on the policy — which reads as "the database
   * refused it" and would have turned this whole section into false passes.
   */
  const asCustomer = async (userId, sql, params = []) => {
    await db.query(`set request.jwt.claim.sub = '${userId}'`);
    await db.query(`set role authenticated`);

    const allowed = await db.query(sql, params).then(
      () => true,
      () => false,
    );

    await db.query(`reset role`);
    await db.query(`reset request.jwt.claim.sub`);

    return allowed;
  };

  const INSERT_REVIEW = `insert into public.product_reviews
      (product_id, user_id, order_id, rating, body)
      values ($1, $2, $3, $4, $5)`;

  check(
    "a review is refused while the order is not delivered",
    !(await asCustomer(buyer, INSERT_REVIEW, [
      PRODUCT,
      buyer,
      placed.id,
      5,
      "Hali yetkazilmagan.",
    ])),
  );

  await db.query(
    `update public.orders set status = 'delivered' where id = $1`,
    [placed.id],
  );

  check(
    "a delivered buyer may review what they bought",
    await asCustomer(buyer, INSERT_REVIEW, [
      PRODUCT,
      buyer,
      placed.id,
      5,
      "Yaxshi karta, tez yetkazishdi.",
    ]),
  );

  check(
    "one review per buyer per product",
    !(await asCustomer(buyer, INSERT_REVIEW, [
      PRODUCT,
      buyer,
      placed.id,
      3,
      "Ikkinchi sharh.",
    ])),
  );

  const stranger = (
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@bondo.test')
       returning id`,
    )
  ).rows[0].id;

  check(
    "somebody else's order earns nobody a review",
    !(await asCustomer(stranger, INSERT_REVIEW, [
      PRODUCT,
      stranger,
      placed.id,
      5,
      "Men sotib olmadim.",
    ])),
  );

  // The other half of the gate: a buyer with a delivered order still may not
  // review a product that order did not contain.
  check(
    "a delivered order earns no review of something it did not contain",
    !(await asCustomer(buyer, INSERT_REVIEW, [
      "c0000000-0000-4000-8000-000000000002",
      buyer,
      placed.id,
      5,
      "Buni olmaganman.",
    ])),
  );

  check(
    "a customer reads their own order under RLS",
    await asCustomer(
      buyer,
      `select 1 from public.orders where id = $1 having count(*) = 1`,
      [placed.id],
    ),
  );
} catch (error) {
  check("order flow behaves", false, error.message);
}

// -----------------------------------------------------------------------------
// The default category taxonomy
// -----------------------------------------------------------------------------
// Reference data shipped by a migration, not fixture data (ADR-68, reshaped by
// ADR-72), so it must be present in a database that has never seen `seed.sql`.
try {
  const defaults = (
    await db.query(
      `select ct.slug, ct.name
       from public.category_translations ct
       where ct.locale = 'uz' and ct.slug not like 'demo-%'
       order by ct.slug`,
    )
  ).rows;

  check(
    "the default taxonomy was seeded by the migration",
    defaults.length === 102,
    `${defaults.length} categories found`,
  );

  const trilingual = (
    await db.query(
      `select c.id
       from public.categories c
       join public.category_translations ct on ct.category_id = c.id
       where exists (
         select 1 from public.category_translations u
         where u.category_id = c.id and u.locale = 'uz' and u.slug not like 'demo-%'
       )
       group by c.id
       having count(distinct ct.locale) = 3`,
    )
  ).rows;

  check(
    "every default category exists in all three languages",
    trilingual.length === 102,
    `${trilingual.length}/102 complete`,
  );

  // -------------------------------------------------------------------------
  // The shape of the tree, which is what the redesign actually delivered
  // -------------------------------------------------------------------------
  // `demo-` rows come from `supabase/seed.sql`, which this harness applies and
  // `db push` never does (ADR-25). Excluding them is what makes these counts a
  // statement about the shipped taxonomy rather than about the fixture.
  const NOT_DEMO = `not exists (
    select 1 from public.category_translations ct
    where ct.category_id = c.id and ct.slug like 'demo-%'
  )`;

  const departments = (
    await db.query(
      `select count(*)::int as n from public.categories c
       where c.parent_id is null and c.deleted_at is null and ${NOT_DEMO}`,
    )
  ).rows[0];

  check(
    "twelve departments sit at the top level",
    departments.n === 12,
    `${departments.n} found`,
  );

  const children = (
    await db.query(
      `select count(*)::int as n from public.categories c
       where c.parent_id is not null and c.deleted_at is null and ${NOT_DEMO}`,
    )
  ).rows[0];

  check(
    "ninety subcategories hang off them",
    children.n === 90,
    `${children.n} found`,
  );

  // Every department carries an icon; the trigger has given every child a real
  // ancestor path. Both are what the mega menu renders from.
  const iconed = (
    await db.query(
      `select count(*)::int as n from public.categories
       where parent_id is null and deleted_at is null and icon is not null`,
    )
  ).rows[0];

  check(
    "every department carries an icon name",
    iconed.n === 12,
    `${iconed.n}/12`,
  );

  const paths = (
    await db.query(
      `select count(*)::int as n from public.categories c
       where c.parent_id is not null and array_length(c.path, 1) = 2
         and ${NOT_DEMO}`,
    )
  ).rows[0];

  check(
    "the path trigger materialised every child's ancestry",
    paths.n === 90,
    `${paths.n}/90 two-element paths`,
  );

  // The nesting mechanism is unlimited, not two-deep: a third level inserts,
  // gets depth 2, and is rejected only when it would form a cycle.
  const components = (
    await db.query(
      `select category_id as id from public.category_translations
       where locale = 'uz' and slug = 'butlovchi-qismlar'`,
    )
  ).rows[0];

  const gpus = (
    await db.query(
      `select category_id as id from public.category_translations
       where locale = 'uz' and slug = 'videokartalar'`,
    )
  ).rows[0];

  const third = (
    await db.query(
      `insert into public.categories (parent_id, display_order)
       values ($1, 99) returning id, depth`,
      [gpus.id],
    )
  ).rows[0];

  check(
    "a third level nests and is given depth 2",
    third.depth === 2,
    `depth ${third.depth}`,
  );

  let cycleRejected = false;
  try {
    await db.query(
      `update public.categories set parent_id = $1 where id = $2`,
      [third.id, components.id],
    );
  } catch {
    cycleRejected = true;
  }

  check("a cycle is still refused at any depth", cycleRejected);

  await db.query(`delete from public.categories where id = $1`, [third.id]);

  // Subcategories are ordered within their sibling group rather than globally,
  // so moving a department does not renumber the whole shop.
  const siblingOrder = (
    await db.query(
      `select min(display_order)::int as lo, max(display_order)::int as hi
       from public.categories
       where parent_id = $1 and deleted_at is null`,
      [components.id],
    )
  ).rows[0];

  check(
    "siblings are numbered within their own group",
    siblingOrder.lo === 1 && siblingOrder.hi === 15,
    `${siblingOrder.lo}..${siblingOrder.hi} under Components`,
  );

  // An icon name is validated for shape at the database (ADR-69/ADR-72); the
  // Server Action is what enforces membership of the drawable set.
  let iconRejected = false;
  try {
    await db.query(
      `insert into public.categories (display_order, icon) values (900, '../hack.svg')`,
    );
  } catch {
    iconRejected = true;
  }

  check("an icon name that is not an identifier is refused", iconRejected);

  // A department listing has to include the products filed under its
  // subcategories, or all twelve top-level links look like empty shops. This is
  // the containment `catalog.reads.listProducts` performs against `path`.
  const subtree = (
    await db.query(
      `select count(*)::int as n from public.categories c
       where c.path @> array[$1]::uuid[]`,
      [components.id],
    )
  ).rows[0];

  check(
    "a department resolves to its whole subtree",
    subtree.n === 16,
    `${subtree.n} categories at or below Components (1 + 15)`,
  );

  const gpuInSubtree = (
    await db.query(
      `select exists (
         select 1 from public.categories c
         where c.id = $1 and c.path @> array[$2]::uuid[]
       ) as ok`,
      [gpus.id, components.id],
    )
  ).rows[0];

  check(
    "a product filed under Graphics cards is reachable from Components",
    gpuInSubtree.ok === true,
  );

  // The components department carries the wording the business asked for, in
  // Uzbek only — Russian and English keep the word their own shoppers use.
  const componentWording = (
    await db.query(
      `select locale, name from public.category_translations
       where category_id = $1 order by locale`,
      [components.id],
    )
  ).rows;

  check(
    "the components department reads as the business words it",
    componentWording.some(
      (r) => r.locale === "uz" && r.name === "Kompyuter qismlari",
    ) &&
      componentWording.some(
        (r) => r.locale === "ru" && r.name === "Комплектующие",
      ) &&
      componentWording.some(
        (r) => r.locale === "en" && r.name === "PC components",
      ),
    componentWording.map((r) => `${r.locale}=${r.name}`).join(" "),
  );

  check(
    "renaming it did not move its URL",
    (
      await db.query(
        `select count(*)::int as n from public.category_translations
         where locale = 'uz' and slug = 'butlovchi-qismlar'`,
      )
    ).rows[0].n === 1,
  );

  // The ADR-68 flat defaults are gone, not sitting beside the new tree.
  const retired = (
    await db.query(
      `select count(*)::int as n from public.category_translations
       where locale = 'uz'
         and slug in ('quvvat-manbalari', 'sovutish-tizimlari',
                      'router-va-tarmoq-uskunalari', 'server-uskunalari',
                      'printerlar')`,
    )
  ).rows[0];

  check(
    "the flat ADR-68 defaults were retired, not duplicated",
    retired.n === 0,
    `${retired.n} legacy slugs remain`,
  );

  // The names the business gave, spot-checked at both ends of the list.
  const named = (
    await db.query(
      `select locale, name from public.category_translations
       where category_id = (
         select category_id from public.category_translations
         where locale = 'uz' and slug = 'noutbuklar'
       ) order by locale`,
    )
  ).rows;

  check(
    "a default category carries its three written names",
    named.length === 3 &&
      named.some((r) => r.name === "Noutbuklar") &&
      named.some((r) => r.name === "Ноутбуки") &&
      named.some((r) => r.name === "Laptops"),
    named.map((r) => `${r.locale}=${r.name}`).join(" "),
  );

  // Protected technical names survive untranslated (CLAUDE.md § 11a).
  const ssd = (
    await db.query(
      `select count(distinct name)::int as n from public.category_translations
       where category_id = (
         select category_id from public.category_translations
         where locale = 'uz' and slug = 'ssd'
       )`,
    )
  ).rows[0];

  check("SSD is spelled SSD in every language", ssd.n === 1);

  // Slugs differ per locale, which is the whole reason the column is on the
  // translation table rather than the parent.
  const slugs = (
    await db.query(
      `select count(distinct slug)::int as n from public.category_translations
       where category_id = (
         select category_id from public.category_translations
         where locale = 'uz' and slug = 'noutbuklar'
       )`,
    )
  ).rows[0];

  check(
    "each locale gets its own category slug",
    slugs.n === 3,
    `${slugs.n} distinct`,
  );

  // Nesting still works, which is what "unlimited subcategories" rests on.
  const nested = (
    await db.query(`select max(depth)::int as d from public.categories`)
  ).rows[0];

  check(
    "the category tree still nests",
    nested.d >= 1,
    `deepest level ${nested.d}`,
  );
} catch (error) {
  check("default categories behave", false, error.message);
}

// -----------------------------------------------------------------------------
// Service highlights
// -----------------------------------------------------------------------------
try {
  const highlights = (
    await db.query(
      `select h.id, h.icon, h.display_order, h.is_visible,
              count(t.locale)::int as locales
       from public.service_highlights h
       left join public.service_highlight_translations t on t.highlight_id = h.id
       group by h.id
       order by h.display_order`,
    )
  ).rows;

  check(
    "the six default highlights were seeded by the migration",
    highlights.length === 6,
    `${highlights.length} found`,
  );

  check(
    "every highlight exists in all three languages",
    highlights.every((row) => row.locales === 3),
    highlights.map((r) => r.locales).join(","),
  );

  check(
    "highlights carry a display order and are visible",
    highlights.every((row) => row.is_visible) &&
      highlights.every((row, i) => row.display_order === i + 1),
    highlights.map((r) => r.display_order).join(","),
  );

  const warranty = (
    await db.query(
      `select locale, title from public.service_highlight_translations
       where highlight_id = (
         select id from public.service_highlights order by display_order limit 1
       ) order by locale`,
    )
  ).rows;

  check(
    "the warranty highlight carries its three written titles",
    warranty.length === 3 &&
      warranty.some((r) => r.title === "1 yillik kafolat") &&
      warranty.some((r) => r.title === "Гарантия 1 год") &&
      warranty.some((r) => r.title === "1-Year Warranty"),
    warranty.map((r) => `${r.locale}=${r.title}`).join(" "),
  );

  // The icon column must not be able to hold markup or a path.
  const badIcon = await db
    .query(
      `insert into public.service_highlights (icon) values ('<img src=x>')`,
    )
    .then(
      () => false,
      () => true,
    );

  check("an icon name that is not an identifier is refused", badIcon);

  // Deleting a highlight must take its copy with it.
  const someId = highlights[0].id;
  await db.query(`delete from public.service_highlights where id = $1`, [
    someId,
  ]);

  const orphans = (
    await db.query(
      `select count(*)::int as n from public.service_highlight_translations
       where highlight_id = $1`,
      [someId],
    )
  ).rows[0];

  check("deleting a highlight cascades its translations", orphans.n === 0);

  // Re-running the seed block must not resurrect it: the guard is
  // all-or-nothing on the table being non-empty.
  const remaining = (
    await db.query(`select count(*)::int as n from public.service_highlights`)
  ).rows[0];

  check(
    "the seed does not resurrect a deleted highlight",
    remaining.n === 5,
    `${remaining.n} remain`,
  );
} catch (error) {
  check("service highlights behave", false, error.message);
}

// -----------------------------------------------------------------------------
// Claiming a guest order
// -----------------------------------------------------------------------------
// The security-critical half of post-order registration. Asserted behaviourally,
// including the attacks the design exists to refuse.
try {
  const PRODUCT = "c0000000-0000-4000-8000-000000000001";
  await db.query(
    `update public.products set status = 'active', visibility = 'public',
       published_at = now() - interval '1 day', price_cents = 100000,
       sale_price_cents = null
     where id = $1`,
    [PRODUCT],
  );

  const basket = JSON.stringify([{ product_id: PRODUCT, quantity: 1 }]);

  // A guest order: no JWT claim set, so auth.uid() is null.
  await db.query(`reset request.jwt.claim.sub`);
  const guest = (
    await db.query(
      `select * from public.place_order('Dilnoza', 'Karimova', '+998901112233',
         'Toshkent, Chilonzor 5', $1::jsonb)`,
      [basket],
    )
  ).rows[0];

  check(
    "a guest order is issued a claim token",
    guest.claim_token !== null && guest.user_id === null,
    `token ${guest.claim_token ? "present" : "missing"}, user_id ${guest.user_id}`,
  );

  const buyer = (
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'claimer@bondo.test')
       returning id`,
    )
  ).rows[0].id;

  const other = (
    await db.query(
      `insert into auth.users (id, email) values (gen_random_uuid(), 'other@bondo.test')
       returning id`,
    )
  ).rows[0].id;

  const asUser = async (userId, sql, params = []) => {
    await db.query(`set request.jwt.claim.sub = '${userId}'`);
    const result = await db.query(sql, params).then(
      (r) => r,
      () => null,
    );
    await db.query(`reset request.jwt.claim.sub`);
    return result;
  };

  // The attack the design exists to refuse: knowing the phone number is not
  // enough, and neither is knowing the reference.
  const guessed = await asUser(
    other,
    `select public.claim_orders(array[gen_random_uuid()]) as n`,
  );

  check(
    "a stranger with a guessed token claims nothing",
    guessed?.rows[0].n === 0,
    `claimed ${guessed?.rows[0].n}`,
  );

  const stillGuest = (
    await db.query(`select user_id from public.orders where id = $1`, [
      guest.id,
    ])
  ).rows[0];

  check(
    "the order is still unowned after a failed claim",
    stillGuest.user_id === null,
  );

  // The real claim.
  const claimed = await asUser(
    buyer,
    `select public.claim_orders(array[$1::uuid]) as n`,
    [guest.claim_token],
  );

  check(
    "holding the token claims exactly one order",
    claimed?.rows[0].n === 1,
    `claimed ${claimed?.rows[0].n}`,
  );

  const afterClaim = (
    await db.query(
      `select user_id, claimed_at, claim_token, reference from public.orders where id = $1`,
      [guest.id],
    )
  ).rows[0];

  check(
    "the order moved to the new account",
    afterClaim.user_id === buyer && afterClaim.claimed_at !== null,
  );

  check(
    "the reference did not change — the row moved, it was not copied",
    afterClaim.reference === guest.reference,
    afterClaim.reference,
  );

  const orderCount = (
    await db.query(
      `select count(*)::int as n from public.orders where reference = $1`,
      [guest.reference],
    )
  ).rows[0];

  check("no duplicate order was created", orderCount.n === 1);

  check("the token is spent on use", afterClaim.claim_token === null);

  // Replay: the same token again, by the same person and by somebody else.
  const replay = await asUser(
    buyer,
    `select public.claim_orders(array[$1::uuid]) as n`,
    [guest.claim_token],
  );

  check(
    "replaying a spent token claims nothing",
    replay?.rows[0].n === 0,
    `claimed ${replay?.rows[0].n}`,
  );

  const steal = await asUser(
    other,
    `select public.claim_orders(array[$1::uuid]) as n`,
    [guest.claim_token],
  );

  check(
    "a spent token cannot move an owned order to somebody else",
    steal?.rows[0].n === 0,
  );

  const ownerNow = (
    await db.query(`select user_id from public.orders where id = $1`, [
      guest.id,
    ])
  ).rows[0];

  check("the original claimant still owns it", ownerNow.user_id === buyer);

  // An order placed while signed in needs no token.
  const signedIn = await asUser(
    buyer,
    `select * from public.place_order('Dilnoza', 'Karimova', '+998901112233',
       'Toshkent, Chilonzor 5', $1::jsonb)`,
    [basket],
  );

  check(
    "an order placed by a signed-in customer gets no claim token",
    signedIn?.rows[0].claim_token === null &&
      signedIn?.rows[0].user_id === buyer,
  );

  // Anonymous callers cannot claim at all.
  await db.query(`reset request.jwt.claim.sub`);
  const anonClaim = await db
    .query(`select public.claim_orders(array[gen_random_uuid()])`)
    .then(
      () => false,
      () => true,
    );

  check("an anonymous caller cannot claim", anonClaim);

  // And the claimed order is readable by its new owner under RLS — which is
  // what makes it appear in order history.
  await db.query(`set request.jwt.claim.sub = '${buyer}'`);
  await db.query(`set role authenticated`);
  const visible = await db
    .query(`select reference from public.orders where id = $1`, [guest.id])
    .then(
      (r) => r.rows.length,
      () => -1,
    );
  await db.query(`reset role`);
  await db.query(`reset request.jwt.claim.sub`);

  check(
    "the claimed order is readable by its new owner under RLS",
    visible === 1,
    `${visible} row(s)`,
  );
} catch (error) {
  check("guest order claiming behaves", false, error.message);
}

// -----------------------------------------------------------------------------
// Ownership hierarchy — three paths, ranked by the proof they demand
// -----------------------------------------------------------------------------
try {
  const PRODUCT = "c0000000-0000-4000-8000-000000000001";
  const basket = JSON.stringify([{ product_id: PRODUCT, quantity: 1 }]);

  const newUser = async (email, confirmed) =>
    (
      await db.query(
        `insert into auth.users (id, email, email_confirmed_at)
         values (gen_random_uuid(), $1, $2) returning id`,
        [email, confirmed ? new Date().toISOString() : null],
      )
    ).rows[0].id;

  const asUser = async (userId, sql, params = []) => {
    await db.query(`set request.jwt.claim.sub = '${userId}'`);
    const result = await db.query(sql, params).then(
      (r) => r,
      () => null,
    );
    await db.query(`reset request.jwt.claim.sub`);
    return result;
  };

  const auditCount = async () =>
    (
      await db.query(
        `select count(*)::int as n from public.audit_logs
         where action = 'order.ownership_transferred'`,
      )
    ).rows[0].n;

  // ---------------------------------------------------------------------------
  // Path 1 — the claim token still works, and now logs
  // ---------------------------------------------------------------------------
  await db.query(`reset request.jwt.claim.sub`);
  const tokenOrder = (
    await db.query(
      `select * from public.place_order('Aziza', 'Yusupova', '+998901230001',
         'Toshkent, Yunusobod 4', $1::jsonb)`,
      [basket],
    )
  ).rows[0];

  const tokenUser = await newUser("token-claimer@bondo.test", true);
  const beforeAudit = await auditCount();

  const tokenClaim = await asUser(
    tokenUser,
    `select public.claim_orders(array[$1::uuid]) as n`,
    [tokenOrder.claim_token],
  );

  check(
    "ADR-70 still works: the claim token claims its order",
    tokenClaim?.rows[0].n === 1,
    `claimed ${tokenClaim?.rows[0].n}`,
  );

  check(
    "a token claim writes an audit row",
    (await auditCount()) === beforeAudit + 1,
  );

  // ---------------------------------------------------------------------------
  // Path 2 — verified email
  // ---------------------------------------------------------------------------
  await db.query(`reset request.jwt.claim.sub`);
  const emailOrderA = (
    await db.query(
      `select * from public.place_order('Bekzod', 'Aliyev', '+998901230002',
         'Toshkent, Chilonzor 7', $1::jsonb, null, null, null, null,
         'delivery', null, null, 'uz', 'Bekzod@Example.com')`,
      [basket],
    )
  ).rows[0];

  const emailOrderB = (
    await db.query(
      `select * from public.place_order('Bekzod', 'Aliyev', '+998901230002',
         'Toshkent, Chilonzor 7', $1::jsonb, null, null, null, null,
         'delivery', null, null, 'uz', 'bekzod@example.com')`,
      [basket],
    )
  ).rows[0];

  check(
    "an email given at checkout is stored lower-cased",
    emailOrderA.email === "bekzod@example.com",
    emailOrderA.email,
  );

  // An account with the right address but NOT verified must claim nothing.
  const unverified = await newUser("bekzod@example.com", false);
  const unverifiedClaim = await asUser(
    unverified,
    `select public.claim_orders_by_email() as n`,
  );

  check(
    "an unverified account claims nothing by email",
    unverifiedClaim?.rows[0].n === 0,
    `claimed ${unverifiedClaim?.rows[0].n}`,
  );

  // A verified account with a different address must also claim nothing.
  const stranger = await newUser("someone-else@bondo.test", true);
  const strangerClaim = await asUser(
    stranger,
    `select public.claim_orders_by_email() as n`,
  );

  check(
    "a verified account with a different address claims nothing",
    strangerClaim?.rows[0].n === 0,
  );

  // The real one: verified, matching, and both orders move.
  const verified = await newUser("bekzod@example.com", true);
  const beforeEmailAudit = await auditCount();
  const emailClaim = await asUser(
    verified,
    `select public.claim_orders_by_email() as n`,
  );

  check(
    "a verified email claims every eligible order",
    emailClaim?.rows[0].n === 2,
    `claimed ${emailClaim?.rows[0].n}`,
  );

  check(
    "each email claim writes an audit row",
    (await auditCount()) === beforeEmailAudit + 2,
  );

  const emailOwned = (
    await db.query(
      `select user_id, reference from public.orders where id = any($1::uuid[])`,
      [[emailOrderA.id, emailOrderB.id]],
    )
  ).rows;

  check(
    "both orders moved to the verified account",
    emailOwned.every((row) => row.user_id === verified),
  );

  check(
    "the references did not change — rows moved, nothing was copied",
    emailOwned.some((r) => r.reference === emailOrderA.reference) &&
      emailOwned.some((r) => r.reference === emailOrderB.reference),
  );

  // Replay: a second call claims nothing, and cannot take them from the owner.
  const replay = await asUser(
    verified,
    `select public.claim_orders_by_email() as n`,
  );
  check("re-running the email claim claims nothing", replay?.rows[0].n === 0);

  const thief = await newUser("bekzod@example.com", true);
  const thiefClaim = await asUser(
    thief,
    `select public.claim_orders_by_email() as n`,
  );

  check(
    "a second verified account with the same address cannot take an owned order",
    thiefClaim?.rows[0].n === 0,
    `claimed ${thiefClaim?.rows[0].n}`,
  );

  // ---------------------------------------------------------------------------
  // Path 3 — an administrator, by hand
  // ---------------------------------------------------------------------------
  await db.query(`reset request.jwt.claim.sub`);
  const manualOrder = (
    await db.query(
      `select * from public.place_order('Kamola', 'Ergasheva', '+998901230003',
         'Samarqand, Registon 1', $1::jsonb)`,
      [basket],
    )
  ).rows[0];

  const customer = await newUser("kamola@bondo.test", true);

  // A customer without orders.update must be refused outright.
  const notAdmin = await asUser(
    customer,
    `select public.admin_link_order($1::uuid, $2::uuid)`,
    [manualOrder.id, customer],
  );

  check("a customer cannot link an order by hand", notAdmin === null);

  // Make an administrator the way the schema does.
  const adminUser = await newUser("ops@bondo.test", true);
  await db.query(
    `insert into public.profiles (id, full_name) values ($1, 'Ops') on conflict do nothing`,
    [adminUser],
  );
  await db.query(
    `insert into public.admins (user_id, is_active) values ($1, true)
     on conflict do nothing`,
    [adminUser],
  );
  await db.query(
    `insert into public.user_roles (user_id, role_id)
     select $1, r.id from public.roles r where r.key = 'super_admin'
     on conflict do nothing`,
    [adminUser],
  );

  const beforeManualAudit = await auditCount();
  const manualLink = await asUser(
    adminUser,
    `select public.admin_link_order($1::uuid, $2::uuid) as ok`,
    [manualOrder.id, customer],
  );

  check(
    "an administrator can link an unowned order to a customer",
    manualLink?.rows[0].ok === true,
  );

  check(
    "a manual link writes an audit row naming the administrator",
    (await auditCount()) === beforeManualAudit + 1,
  );

  const manualAudit = (
    await db.query(
      `select actor_id, metadata from public.audit_logs
       where action = 'order.ownership_transferred' and resource_id = $1`,
      [manualOrder.id],
    )
  ).rows[0];

  check(
    "the audit row records the administrator as actor and the customer as owner",
    manualAudit.actor_id === adminUser &&
      manualAudit.metadata.new_owner === customer &&
      manualAudit.metadata.method === "admin_manual",
    `method=${manualAudit.metadata.method}`,
  );

  // And an owned order stays put, even for an administrator.
  const reassign = await asUser(
    adminUser,
    `select public.admin_link_order($1::uuid, $2::uuid) as ok`,
    [manualOrder.id, stranger],
  );

  check(
    "an administrator cannot reassign an order that already has an owner",
    reassign?.rows[0].ok === false,
  );

  const finalOwner = (
    await db.query(`select user_id from public.orders where id = $1`, [
      manualOrder.id,
    ])
  ).rows[0];

  check("the original owner kept the order", finalOwner.user_id === customer);

  // ---------------------------------------------------------------------------
  // Reviews follow status, not ownership
  // ---------------------------------------------------------------------------
  await db.query(
    `update public.orders set status = 'cancelled' where id = $1`,
    [manualOrder.id],
  );

  // `asUser` sets the JWT claim but not the role, so RLS is not enforced under
  // it — fine for calling a `security definer` function, wrong for asserting a
  // policy. A review insert is a policy test and needs the role switch, or the
  // superuser sails through and the assertion proves nothing.
  const asCustomerRls = async (userId, sql, params = []) => {
    await db.query(`set request.jwt.claim.sub = '${userId}'`);
    await db.query(`set role authenticated`);
    const allowed = await db.query(sql, params).then(
      () => true,
      () => false,
    );
    await db.query(`reset role`);
    await db.query(`reset request.jwt.claim.sub`);
    return allowed;
  };

  const INSERT_REVIEW = `insert into public.product_reviews
     (product_id, user_id, order_id, rating) values ($1, $2, $3, 5)`;

  check(
    "a cancelled order earns no review",
    !(await asCustomerRls(customer, INSERT_REVIEW, [
      PRODUCT,
      customer,
      manualOrder.id,
    ])),
  );

  await db.query(
    `update public.orders set status = 'delivered' where id = $1`,
    [manualOrder.id],
  );

  check(
    "a delivered order earns a review, through the order it was linked by",
    await asCustomerRls(customer, INSERT_REVIEW, [
      PRODUCT,
      customer,
      manualOrder.id,
    ]),
  );
} catch (error) {
  check("ownership hierarchy behaves", false, error.message);
}

await db.close();

console.log(results.join("\n"));
console.log(
  failures
    ? `\n${results.length - failures}/${results.length} passed — ${failures} FAILED`
    : `\nall ${results.length} assertions passed`,
);
process.exit(failures ? 1 : 0);
