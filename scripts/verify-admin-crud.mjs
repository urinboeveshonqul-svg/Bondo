#!/usr/bin/env node
/**
 * Exercises admin CRUD against the **live** Supabase project.
 *
 * The point is to run as a real administrator through the RLS-enforced anon
 * client — not the service role. A service-role script proves the schema
 * accepts a row and nothing else; the layer most likely to refuse an admin
 * write is `has_permission()`, and bypassing RLS is exactly how you fail to
 * notice that.
 *
 * So it: mints a throwaway admin with the service role, signs in as them with
 * the public anon key, and does every write through that session. Afterwards it
 * removes everything it made, including the user.
 *
 * **What this proves:** Supabase client → RLS → database → Storage.
 * **What it does not:** the TypeScript service wrappers themselves, which are
 * covered by typecheck and the production build. The SQL below is deliberately
 * the same shape those services issue.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
let failures = 0;
const check = (name, ok, detail) => {
  results.push(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

const stamp = Date.now();
const EMAIL = `crud-${stamp}@bondo.test`;
const PASSWORD = `Crud-${stamp}-Aa1!`;

let userId = null;
const made = {
  banner: null,
  contentPage: null,
  mateUser: null,
  settingsBefore: [],
  brand: null,
  category: null,
  childCategory: null,
  product: null,
  brandB: null,
  catalogProducts: [],
  uploads: [],
  upload: null,
};

try {
  // ---------------------------------------------------------------------------
  // A throwaway administrator
  // ---------------------------------------------------------------------------
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  await admin
    .from("admins")
    .insert({ user_id: userId, is_active: true })
    .then(({ error }) => {
      if (error && error.code !== "23505") throw error;
    });

  const role = await admin
    .from("roles")
    .select("id")
    .eq("key", "super_admin")
    .single();
  if (role.error) throw role.error;

  await admin
    .from("user_roles")
    .insert({ user_id: userId, role_id: role.data.id })
    .then(({ error }) => {
      if (error && error.code !== "23505") throw error;
    });

  // ---------------------------------------------------------------------------
  // Sign in as them — everything below runs under RLS
  // ---------------------------------------------------------------------------
  const asAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const signIn = await asAdmin.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  check("an administrator can sign in", !signIn.error, signIn.error?.message);
  if (signIn.error) throw signIn.error;

  const perms = await asAdmin.rpc("has_permission", {
    permission_key: "products.create",
  });
  check(
    "RLS resolves the administrator's permissions",
    perms.data === true,
    `has_permission(products.create) = ${perms.data}`,
  );

  // ---------------------------------------------------------------------------
  // BRAND — create, read, update, delete
  // ---------------------------------------------------------------------------
  const brandSlug = `crud-brand-${stamp}`;
  const brandIns = await asAdmin
    .from("brands")
    .insert({ name: `CRUD Brand ${stamp}`, slug: brandSlug, is_visible: true })
    .select("id, name")
    .single();
  check("BRAND create", !brandIns.error, brandIns.error?.message);
  made.brand = brandIns.data?.id ?? null;

  const brandRead = await asAdmin
    .from("brands")
    .select("id, name, slug")
    .eq("id", made.brand)
    .single();
  check(
    "BRAND read",
    !brandRead.error && brandRead.data?.slug === brandSlug,
    brandRead.error?.message ?? brandRead.data?.slug,
  );

  const brandUpd = await asAdmin
    .from("brands")
    .update({ name: `CRUD Brand ${stamp} (edited)` })
    .eq("id", made.brand)
    .select("name")
    .single();
  check(
    "BRAND update",
    !brandUpd.error && brandUpd.data?.name.endsWith("(edited)"),
    brandUpd.error?.message ?? brandUpd.data?.name,
  );

  // ---------------------------------------------------------------------------
  // CATEGORY — create + translations, read, update, delete
  // ---------------------------------------------------------------------------
  const catIns = await asAdmin
    .from("categories")
    .insert({ display_order: 999, is_visible: true })
    .select("id")
    .single();
  check("CATEGORY create", !catIns.error, catIns.error?.message);
  made.category = catIns.data?.id ?? null;

  const catTr = await asAdmin.from("category_translations").insert([
    {
      category_id: made.category,
      locale: "uz",
      name: `CRUD ${stamp}`,
      slug: `crud-cat-uz-${stamp}`,
    },
    {
      category_id: made.category,
      locale: "ru",
      name: `CRUD ${stamp}`,
      slug: `crud-cat-ru-${stamp}`,
    },
    {
      category_id: made.category,
      locale: "en",
      name: `CRUD ${stamp}`,
      slug: `crud-cat-en-${stamp}`,
    },
  ]);
  check(
    "CATEGORY create translations (3 locales)",
    !catTr.error,
    catTr.error?.message,
  );

  const catRead = await asAdmin
    .from("categories")
    .select(
      "id, display_order, translations:category_translations(locale, name)",
    )
    .eq("id", made.category)
    .single();
  check(
    "CATEGORY read with translations",
    !catRead.error && catRead.data?.translations?.length === 3,
    catRead.error?.message ?? `${catRead.data?.translations?.length} locales`,
  );

  const catUpd = await asAdmin
    .from("category_translations")
    .update({ name: `CRUD ${stamp} edited` })
    .eq("category_id", made.category)
    .eq("locale", "uz")
    .select("name")
    .single();
  check(
    "CATEGORY update translation",
    !catUpd.error && catUpd.data?.name.endsWith("edited"),
    catUpd.error?.message ?? catUpd.data?.name,
  );

  // ---------------------------------------------------------------------------
  // CATEGORY TREE — nesting, re-parenting, ordering, icon, featured, SEO
  // ---------------------------------------------------------------------------
  // Everything the admin's category screen offers, exercised through the same
  // RLS-enforced session. These are the writes `saveCategory`,
  // `reorderCategories` and `setCategoryVisibility` issue.
  const childIns = await asAdmin
    .from("categories")
    .insert({
      parent_id: made.category,
      display_order: 1,
      is_visible: true,
      icon: "Cpu",
      is_featured: true,
    })
    .select("id, depth, path, icon, is_featured")
    .single();
  check(
    "CATEGORY create a subcategory",
    !childIns.error,
    childIns.error?.message,
  );
  made.childCategory = childIns.data?.id ?? null;

  check(
    "the path trigger nested it without being asked",
    childIns.data?.depth === 1 && childIns.data?.path?.length === 2,
    `depth ${childIns.data?.depth}, path length ${childIns.data?.path?.length}`,
  );

  check(
    "the icon and featured columns accept an operator's choice",
    childIns.data?.icon === "Cpu" && childIns.data?.is_featured === true,
    `icon=${childIns.data?.icon} featured=${childIns.data?.is_featured}`,
  );

  const badIcon = await asAdmin
    .from("categories")
    .update({ icon: "../evil.svg" })
    .eq("id", made.childCategory);
  check(
    "an icon that is not an identifier is refused by the check constraint",
    !!badIcon.error,
    badIcon.error?.code,
  );

  // The child's translations, including the SEO and Open Graph columns the
  // shared panel writes.
  const childTr = await asAdmin.from("category_translations").insert(
    ["uz", "ru", "en"].map((locale) => ({
      category_id: made.childCategory,
      locale,
      name: `CRUD child ${stamp} ${locale}`,
      slug: `crud-child-${locale}-${stamp}`,
      description: `CRUD description ${locale}`,
      seo_title: `CRUD seo ${locale}`,
      seo_description: `CRUD seo description ${locale}`,
      seo_keywords: ["rtx 4090", "gpu"],
      og_title: `CRUD og ${locale}`,
      og_description: `CRUD og description ${locale}`,
      twitter_card: "summary_large_image",
    })),
  );
  check(
    "CATEGORY subcategory translations with SEO and Open Graph",
    !childTr.error,
    childTr.error?.message,
  );

  const seoRead = await asAdmin
    .from("category_translations")
    .select("locale, slug, seo_title, seo_keywords, og_title, twitter_card")
    .eq("category_id", made.childCategory);
  check(
    "the SEO columns read back per locale",
    seoRead.data?.length === 3 &&
      seoRead.data.every(
        (r) => r.og_title && r.twitter_card === "summary_large_image",
      ) &&
      new Set(seoRead.data.map((r) => r.slug)).size === 3,
    seoRead.error?.message ?? `${seoRead.data?.length} locales, distinct slugs`,
  );

  // Re-parenting to the top level and back — the move a drag performs.
  const detach = await asAdmin
    .from("categories")
    .update({ parent_id: null, display_order: 5 })
    .eq("id", made.childCategory)
    .select("depth, path")
    .single();
  check(
    "re-parenting to the top level updates depth and path",
    detach.data?.depth === 0 && detach.data?.path?.length === 1,
    detach.error?.message ?? `depth ${detach.data?.depth}`,
  );

  const reattach = await asAdmin
    .from("categories")
    .update({ parent_id: made.category, display_order: 1 })
    .eq("id", made.childCategory)
    .select("depth")
    .single();
  check(
    "re-parenting back nests it again",
    reattach.data?.depth === 1,
    reattach.error?.message ?? `depth ${reattach.data?.depth}`,
  );

  // A cycle: making the parent a child of its own child.
  const cycle = await asAdmin
    .from("categories")
    .update({ parent_id: made.childCategory })
    .eq("id", made.category);
  check(
    "a cycle is refused by the trigger, not by the interface",
    !!cycle.error,
    cycle.error?.code ?? "accepted — WRONG",
  );

  // Visibility, the one-click toggle in the list.
  const hide = await asAdmin
    .from("categories")
    .update({ is_visible: false })
    .eq("id", made.childCategory)
    .select("is_visible")
    .single();
  check(
    "a category can be hidden",
    hide.data?.is_visible === false,
    hide.error?.message,
  );

  const anonSeesHidden = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )
    .from("categories")
    .select("id")
    .eq("id", made.childCategory)
    .eq("is_visible", true);
  check(
    "a hidden category is absent from the storefront read",
    anonSeesHidden.data?.length === 0,
    `${anonSeesHidden.data?.length ?? "?"} rows`,
  );

  await asAdmin
    .from("categories")
    .update({ is_visible: true })
    .eq("id", made.childCategory);

  // The shipped taxonomy, seen through the anonymous client — the rows a real
  // visitor's mega menu is built from.
  const anonTree = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )
    .from("categories")
    .select("id, parent_id, icon, translations:category_translations(locale)")
    .is("deleted_at", null)
    .eq("is_visible", true);

  // Excluding this run's own throwaway category, which is a top-level row with
  // no icon and would otherwise make the count 13 and the icon check fail.
  const departments = (anonTree.data ?? []).filter(
    (r) => !r.parent_id && r.id !== made.category,
  );
  check(
    "the shipped taxonomy is live: 12 departments",
    departments.length === 12,
    `${departments.length} departments, ${(anonTree.data ?? []).filter((r) => r.id !== made.category && r.id !== made.childCategory).length} categories total`,
  );
  check(
    "every department carries an icon the storefront can draw",
    departments.every((r) => r.icon),
    departments.map((r) => r.icon).join(" "),
  );

  // ---------------------------------------------------------------------------
  // PRODUCT — create + translations, read, update, publish, storefront read
  // ---------------------------------------------------------------------------
  const sku = `CRUD-${stamp}`;
  const prodIns = await asAdmin
    .from("products")
    .insert({
      sku,
      brand_id: made.brand,
      category_id: made.category,
      price_cents: 1234500,
      status: "draft",
      visibility: "public",
      is_featured: false,
    })
    .select("id, sku, status")
    .single();
  check("PRODUCT create", !prodIns.error, prodIns.error?.message);
  made.product = prodIns.data?.id ?? null;

  const prodSlug = `crud-product-${stamp}`;
  const prodTr = await asAdmin.from("product_translations").insert([
    {
      product_id: made.product,
      locale: "uz",
      name: `CRUD mahsulot ${stamp}`,
      slug: `${prodSlug}-uz`,
    },
    {
      product_id: made.product,
      locale: "ru",
      name: `CRUD товар ${stamp}`,
      slug: `${prodSlug}-ru`,
    },
    {
      product_id: made.product,
      locale: "en",
      name: `CRUD product ${stamp}`,
      slug: `${prodSlug}-en`,
    },
  ]);
  check(
    "PRODUCT create translations (3 locales)",
    !prodTr.error,
    prodTr.error?.message,
  );

  const prodRead = await asAdmin
    .from("products")
    .select(
      "id, sku, price_cents, translations:product_translations(locale, name, slug)",
    )
    .eq("id", made.product)
    .single();
  check(
    "PRODUCT read with translations",
    !prodRead.error && prodRead.data?.translations?.length === 3,
    prodRead.error?.message ?? `${prodRead.data?.translations?.length} locales`,
  );

  const prodUpd = await asAdmin
    .from("products")
    .update({ price_cents: 999900, is_featured: true })
    .eq("id", made.product)
    .select("price_cents, is_featured")
    .single();
  check(
    "PRODUCT update (price + featured)",
    !prodUpd.error &&
      prodUpd.data?.price_cents === 999900 &&
      prodUpd.data?.is_featured === true,
    prodUpd.error?.message ?? `${prodUpd.data?.price_cents}`,
  );

  // Publishing is what makes it a storefront row.
  const publish = await asAdmin
    .from("products")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", made.product)
    .select("status")
    .single();
  check("PRODUCT publish", !publish.error, publish.error?.message);

  // ---------------------------------------------------------------------------
  // The storefront must see it — anonymously
  // ---------------------------------------------------------------------------
  const anon = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  const shopSees = await anon
    .from("products")
    .select("id, sku, translations:product_translations(name)")
    .eq("id", made.product)
    .maybeSingle();
  check(
    "STOREFRONT sees the published product (anonymous)",
    !shopSees.error && shopSees.data?.sku === sku,
    shopSees.error?.message ?? shopSees.data?.sku,
  );

  // ...and must NOT see it once it goes back to draft.
  await asAdmin
    .from("products")
    .update({ status: "draft" })
    .eq("id", made.product);
  const shopHidden = await anon
    .from("products")
    .select("id")
    .eq("id", made.product)
    .maybeSingle();
  check(
    "STOREFRONT does not see a draft product",
    !shopHidden.error && shopHidden.data === null,
    shopHidden.data ? "still visible" : "hidden",
  );

  // ---------------------------------------------------------------------------
  // CATALOG FILTERS AND SORTING — the storefront's own queries, anonymously
  // ---------------------------------------------------------------------------
  // The listing's filters and sort orders cannot be proven against the live
  // catalog, because it is empty — and populating it with invented products is
  // what ADR-20 forbids. So this creates **three throwaway products** with known
  // prices, brands and sale prices, runs the queries
  // `services/products.service.ts` issues, asserts the results, and deletes them
  // again in the `finally` block.
  //
  // Through the **anon** client, so RLS is in the path rather than around it:
  // these are the queries a shopper's request actually makes.
  const secondBrand = await asAdmin
    .from("brands")
    .insert({
      name: `CRUD Brand B ${stamp}`,
      slug: `crud-brand-b-${stamp}`,
      is_visible: true,
    })
    .select("id")
    .single();
  made.brandB = secondBrand.data?.id ?? null;

  // cheap (brand A, on sale) · mid (brand B) · dear (brand A, featured)
  const catalogSpecs = [
    {
      suffix: "CHEAP",
      price: 10000,
      sale: 8000,
      brand: made.brand,
      featured: false,
    },
    {
      suffix: "MID",
      price: 50000,
      sale: null,
      brand: made.brandB,
      featured: false,
    },
    {
      suffix: "DEAR",
      price: 90000,
      sale: null,
      brand: made.brand,
      featured: true,
    },
  ];

  for (const spec of catalogSpecs) {
    const inserted = await asAdmin
      .from("products")
      .insert({
        sku: `CRUD-${spec.suffix}-${stamp}`,
        brand_id: spec.brand,
        category_id: made.category,
        price_cents: spec.price,
        sale_price_cents: spec.sale,
        status: "active",
        visibility: "public",
        is_featured: spec.featured,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (inserted.data) made.catalogProducts.push(inserted.data.id);
  }

  check(
    "three catalog fixtures created",
    made.catalogProducts.length === 3,
    `${made.catalogProducts.length}/3`,
  );

  const inFixtures = (rows) =>
    (rows ?? []).filter((row) => made.catalogProducts.includes(row.id));

  const base = () =>
    anon
      .from("products")
      .select("id, price_cents, sale_price_cents, brand_id, is_featured")
      .eq("status", "active")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .in("category_id", [made.category]);

  const priced = await base()
    .gte("price_cents", 20000)
    .lte("price_cents", 60000);
  const pricedRows = inFixtures(priced.data);
  check(
    "CATALOG price filter returns only what is inside the range",
    pricedRows.length === 1 && pricedRows[0].price_cents === 50000,
    priced.error?.message ?? `${pricedRows.length} row(s)`,
  );

  const branded = await base().in("brand_id", [made.brandB]);
  const brandedRows = inFixtures(branded.data);
  check(
    "CATALOG brand filter returns only that brand",
    brandedRows.length === 1 && brandedRows[0].brand_id === made.brandB,
    branded.error?.message ?? `${brandedRows.length} row(s)`,
  );

  const bothBrands = await base().in("brand_id", [made.brand, made.brandB]);
  check(
    "CATALOG two brands return the union, not the intersection",
    inFixtures(bothBrands.data).length === 3,
    `${inFixtures(bothBrands.data).length} row(s)`,
  );

  const onSale = await base().not("sale_price_cents", "is", null);
  const saleRows = inFixtures(onSale.data);
  check(
    "CATALOG the sale filter returns only discounted products",
    saleRows.length === 1 && saleRows[0].sale_price_cents === 8000,
    onSale.error?.message ?? `${saleRows.length} row(s)`,
  );

  const cheapFirst = await base().order("price_cents", { ascending: true });
  const cheapOrder = inFixtures(cheapFirst.data).map((r) => r.price_cents);
  check(
    "CATALOG price ascending sorts cheapest first",
    JSON.stringify(cheapOrder) === JSON.stringify([10000, 50000, 90000]),
    cheapOrder.join(" < "),
  );

  const dearFirst = await base().order("price_cents", { ascending: false });
  const dearOrder = inFixtures(dearFirst.data).map((r) => r.price_cents);
  check(
    "CATALOG price descending sorts dearest first",
    JSON.stringify(dearOrder) === JSON.stringify([90000, 50000, 10000]),
    dearOrder.join(" > "),
  );

  // "Recommended" is featured-first, then the primary key — the two `.order()`
  // calls the service chains when `featuredFirst` is set.
  const recommended = await base()
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });
  const recommendedRows = inFixtures(recommended.data);
  check(
    "CATALOG recommended puts the featured product first",
    recommendedRows[0]?.is_featured === true,
    recommended.error?.message ??
      recommendedRows.map((r) => r.is_featured).join(","),
  );

  const counted = await anon
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("visibility", "public")
    .is("deleted_at", null)
    .in("category_id", [made.category]);
  check(
    "CATALOG the listing count is exact, not estimated",
    counted.count === 3,
    counted.error?.message ?? `count=${counted.count}`,
  );

  // ---------------------------------------------------------------------------
  // STORAGE — upload into the products bucket
  // ---------------------------------------------------------------------------
  // A 1×1 transparent PNG, so the MIME allow-list is genuinely exercised.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  const path = `crud/${stamp}.png`;
  const up = await asAdmin.storage
    .from("products")
    .upload(path, png, { contentType: "image/png", upsert: true });
  check("STORAGE upload to the products bucket", !up.error, up.error?.message);
  made.upload = up.error ? null : path;

  if (made.upload) {
    const pub = asAdmin.storage.from("products").getPublicUrl(path);
    const fetched = await fetch(pub.data.publicUrl);
    check(
      "STORAGE uploaded image is publicly readable",
      fetched.ok,
      `HTTP ${fetched.status}`,
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE — soft, per the architecture
  // ---------------------------------------------------------------------------
  const prodDel = await asAdmin
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", made.product)
    .select("deleted_at")
    .single();
  check(
    "PRODUCT soft delete",
    !prodDel.error && prodDel.data?.deleted_at !== null,
    prodDel.error?.message,
  );

  const rowStillThere = await admin
    .from("products")
    .select("id, deleted_at")
    .eq("id", made.product)
    .single();
  check(
    "soft delete keeps the row (history survives)",
    !rowStillThere.error && rowStillThere.data?.deleted_at !== null,
  );

  // ---------------------------------------------------------------------------
  // PRODUCT restore, specifications and images — the editor's remaining writes
  // ---------------------------------------------------------------------------
  // Everything the product form and its gallery now do, through the same
  // RLS-enforced administrator session. Each of these was a "nothing was saved"
  // toast before this pass.
  const restored = await asAdmin
    .from("products")
    .update({ deleted_at: null })
    .eq("id", made.product)
    .select("deleted_at")
    .single();
  check(
    "PRODUCT restore brings a soft-deleted row back",
    !restored.error && restored.data?.deleted_at === null,
    restored.error?.message,
  );

  // `replaceSpecifications` is a delete-then-insert, so this asserts the whole
  // set rather than a single row: writing three, then two, must leave two.
  const specsFirst = await asAdmin.from("product_specifications").insert([
    {
      product_id: made.product,
      spec_group: "Display",
      name: "Panel",
      value: "IPS",
      display_order: 0,
    },
    {
      product_id: made.product,
      spec_group: "Display",
      name: "Refresh rate",
      value: "144",
      unit: "Hz",
      display_order: 1,
    },
    {
      product_id: made.product,
      name: "Weight",
      value: "2.3",
      unit: "kg",
      display_order: 2,
    },
  ]);
  check(
    "PRODUCT specifications insert",
    !specsFirst.error,
    specsFirst.error?.message,
  );

  await asAdmin
    .from("product_specifications")
    .delete()
    .eq("product_id", made.product);
  const specsSecond = await asAdmin.from("product_specifications").insert([
    {
      product_id: made.product,
      name: "Panel",
      value: "OLED",
      display_order: 0,
    },
  ]);
  const specsNow = await asAdmin
    .from("product_specifications")
    .select("name, value, unit, spec_group, display_order")
    .eq("product_id", made.product);
  check(
    "PRODUCT specifications replace, not append",
    !specsSecond.error &&
      specsNow.data?.length === 1 &&
      specsNow.data[0].value === "OLED",
    specsSecond.error?.message ?? `${specsNow.data?.length} row(s)`,
  );

  // --- images ---------------------------------------------------------------
  // A real upload into the products bucket, then the row that points at it —
  // which is the pair that makes an image survive a refresh.
  const imgPath = `${made.product}/${stamp}-a.png`;
  const imgUp = await asAdmin.storage
    .from("products")
    .upload(imgPath, png, { contentType: "image/png", upsert: true });
  check("PRODUCT image uploads to storage", !imgUp.error, imgUp.error?.message);
  if (!imgUp.error) made.uploads.push(imgPath);

  const imgRow = await asAdmin
    .from("product_images")
    .insert({
      product_id: made.product,
      storage_path: imgPath,
      display_order: 0,
      is_primary: true,
    })
    .select("id, is_primary")
    .single();
  check(
    "PRODUCT image row written and primary",
    !imgRow.error && imgRow.data?.is_primary === true,
    imgRow.error?.message,
  );

  const imgPath2 = `${made.product}/${stamp}-b.png`;
  const imgUp2 = await asAdmin.storage
    .from("products")
    .upload(imgPath2, png, { contentType: "image/png", upsert: true });
  if (!imgUp2.error) made.uploads.push(imgPath2);

  const imgRow2 = await asAdmin
    .from("product_images")
    .insert({
      product_id: made.product,
      storage_path: imgPath2,
      display_order: 1,
      is_primary: false,
    })
    .select("id")
    .single();

  // Exactly one primary, enforced by a partial unique index — so promoting the
  // second must demote the first, which is what `setPrimaryImage` does in two
  // statements with the demotion first.
  await asAdmin
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", made.product);
  await asAdmin
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imgRow2.data?.id);

  const primaries = await asAdmin
    .from("product_images")
    .select("id, is_primary, display_order")
    .eq("product_id", made.product)
    .order("display_order");
  check(
    "PRODUCT exactly one primary image after promotion",
    primaries.data?.filter((row) => row.is_primary).length === 1 &&
      primaries.data?.find((row) => row.is_primary)?.id === imgRow2.data?.id,
    `${primaries.data?.filter((r) => r.is_primary).length} primary`,
  );

  // Reorder is a display_order write per row — the shape the action sends.
  await asAdmin
    .from("product_images")
    .update({ display_order: 0 })
    .eq("id", imgRow2.data?.id);
  await asAdmin
    .from("product_images")
    .update({ display_order: 1 })
    .eq("id", imgRow.data?.id);
  const reordered = await asAdmin
    .from("product_images")
    .select("id, display_order")
    .eq("product_id", made.product)
    .order("display_order");
  check(
    "PRODUCT images reorder",
    reordered.data?.[0]?.id === imgRow2.data?.id,
    reordered.data?.map((r) => r.display_order).join(","),
  );

  // The gallery is what a shopper sees, so it has to come back through the
  // anonymous client once the product is published.
  await asAdmin
    .from("products")
    .update({
      status: "active",
      visibility: "public",
      published_at: new Date().toISOString(),
    })
    .eq("id", made.product);

  const anonImages = await anon
    .from("products")
    .select("id, images:product_images ( id, storage_path, is_primary )")
    .eq("id", made.product)
    .maybeSingle();
  check(
    "STOREFRONT sees the published product's images",
    anonImages.data?.images?.length === 2,
    anonImages.error?.message ??
      `${anonImages.data?.images?.length ?? 0} image(s)`,
  );

  const imgDel = await asAdmin
    .from("product_images")
    .delete()
    .eq("id", imgRow.data?.id);
  const afterDel = await asAdmin
    .from("product_images")
    .select("id")
    .eq("product_id", made.product);
  check(
    "PRODUCT image delete removes the row",
    !imgDel.error && afterDel.data?.length === 1,
    imgDel.error?.message ?? `${afterDel.data?.length} remaining`,
  );

  // Put it back the way the delete assertions below expect to find it.
  await asAdmin
    .from("products")
    .update({ status: "draft", visibility: "hidden", deleted_at: null })
    .eq("id", made.product);

  const catDel = await asAdmin
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", made.category)
    .select("deleted_at")
    .single();
  check("CATEGORY soft delete", !catDel.error, catDel.error?.message);

  const brandDel = await asAdmin
    .from("brands")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", made.brand)
    .select("deleted_at")
    .single();
  check("BRAND soft delete", !brandDel.error, brandDel.error?.message);

  // ---------------------------------------------------------------------------
  // SETTINGS — key/value plus localized text
  // ---------------------------------------------------------------------------
  // Every key touched here is one the storefront reads: getStoreContact()
  // renders the contact page from store.*. The originals are captured and put
  // back in the finally block, because these are live rows, not throwaways.
  const settingsBefore = await asAdmin
    .from("settings")
    .select("key, value")
    .in("key", ["store.phone", "store.name"]);
  check(
    "SETTINGS read (settings.read)",
    !settingsBefore.error && (settingsBefore.data?.length ?? 0) === 2,
    settingsBefore.error?.message ??
      (settingsBefore.data?.length ?? 0) + " rows",
  );
  made.settingsBefore = settingsBefore.data ?? [];

  const phoneValue = "+998 90 000 " + String(stamp).slice(-4);
  const settingWrite = await asAdmin
    .from("settings")
    .upsert({ key: "store.phone", value: phoneValue }, { onConflict: "key" })
    .select("key")
    .single();
  check(
    "SETTINGS update (settings.update)",
    !settingWrite.error,
    settingWrite.error?.message,
  );

  const settingReadBack = await asAdmin
    .from("settings")
    .select("value")
    .eq("key", "store.phone")
    .single();
  check(
    "SETTINGS persisted after a re-read",
    settingReadBack.data?.value === phoneValue,
    JSON.stringify(settingReadBack.data?.value),
  );

  const trWrite = await asAdmin
    .from("setting_translations")
    .upsert(
      {
        setting_key: "store.address",
        locale: "uz",
        value: "Toshkent " + stamp,
      },
      { onConflict: "setting_key,locale" },
    )
    .select("value")
    .single();
  check(
    "SETTINGS localized value written (setting_translations)",
    !trWrite.error && trWrite.data?.value === "Toshkent " + stamp,
    trWrite.error?.message ?? trWrite.data?.value,
  );

  const anonSetting = await anon
    .from("settings")
    .select("value")
    .eq("key", "store.phone")
    .maybeSingle();
  check(
    "STOREFRONT reads the public setting (anonymous)",
    !anonSetting.error && anonSetting.data?.value === phoneValue,
    anonSetting.error?.message ?? JSON.stringify(anonSetting.data?.value),
  );

  // ---------------------------------------------------------------------------
  // INVENTORY — stock moves only through the ledger
  // ---------------------------------------------------------------------------
  const stockBefore = await asAdmin
    .from("inventory")
    .select("quantity_on_hand")
    .eq("product_id", made.product)
    .single();
  check(
    "INVENTORY read (inventory.read)",
    !stockBefore.error,
    stockBefore.error?.message,
  );

  const movement = await asAdmin
    .from("inventory_movements")
    .insert({
      product_id: made.product,
      movement_type: "purchase",
      quantity_delta: 7,
      quantity_after: 0,
      reason: "crud check " + stamp,
    })
    .select("id, quantity_after")
    .single();
  check(
    "INVENTORY movement recorded (inventory.adjust)",
    !movement.error,
    movement.error?.message,
  );

  const stockAfter = await asAdmin
    .from("inventory")
    .select("quantity_on_hand")
    .eq("product_id", made.product)
    .single();
  check(
    "INVENTORY level moved by the trigger, not by the client",
    stockAfter.data?.quantity_on_hand ===
      (stockBefore.data?.quantity_on_hand ?? 0) + 7,
    stockBefore.data?.quantity_on_hand +
      " -> " +
      stockAfter.data?.quantity_on_hand,
  );

  const directStock = await asAdmin
    .from("inventory")
    .update({ quantity_on_hand: 9999 })
    .eq("product_id", made.product)
    .select("quantity_on_hand");
  check(
    "INVENTORY refuses a direct quantity write (ADR-24 trigger)",
    directStock.error !== null,
    directStock.error?.code ?? "UPDATE SUCCEEDED — LEDGER BYPASSED",
  );

  const threshold = await asAdmin
    .from("inventory")
    .update({ low_stock_threshold: 3 })
    .eq("product_id", made.product)
    .select("low_stock_threshold")
    .single();
  check(
    "INVENTORY threshold update",
    !threshold.error && threshold.data?.low_stock_threshold === 3,
    threshold.error?.message,
  );

  // ---------------------------------------------------------------------------
  // CONTENT PAGES — parent row plus three translations
  // ---------------------------------------------------------------------------
  const pageKey = "crud-page-" + stamp;
  const pageIns = await asAdmin
    .from("content_pages")
    .insert({ key: pageKey, is_published: false, display_order: 900 })
    .select("id")
    .single();
  check(
    "CONTENT PAGE create (banners.manage)",
    !pageIns.error,
    pageIns.error?.message,
  );
  made.contentPage = pageIns.data?.id ?? null;

  const pageTr = await asAdmin.from("content_page_translations").upsert(
    ["uz", "ru", "en"].map((locale) => ({
      page_id: made.contentPage,
      locale,
      title: "CRUD " + locale + " " + stamp,
      body: "Body " + locale,
    })),
    { onConflict: "page_id,locale" },
  );
  check(
    "CONTENT PAGE translations written in all three languages",
    !pageTr.error,
    pageTr.error?.message,
  );

  const anonDraftPage = await anon
    .from("content_pages")
    .select("id")
    .eq("id", made.contentPage)
    .maybeSingle();
  check(
    "STOREFRONT does not see an unpublished page",
    !anonDraftPage.error && anonDraftPage.data === null,
    anonDraftPage.data ? "visible" : "hidden",
  );

  const publishPage = await asAdmin
    .from("content_pages")
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq("id", made.contentPage)
    .select("is_published")
    .single();
  check(
    "CONTENT PAGE publish (published_at required by check constraint)",
    !publishPage.error && publishPage.data?.is_published === true,
    publishPage.error?.message,
  );
  const anonLivePage = await anon
    .from("content_pages")
    .select("id, translations:content_page_translations(locale, title)")
    .eq("id", made.contentPage)
    .maybeSingle();
  check(
    "STOREFRONT sees the page once published (anonymous)",
    !anonLivePage.error && anonLivePage.data?.translations?.length === 3,
    anonLivePage.error?.message ??
      (anonLivePage.data?.translations?.length ?? 0) + " translations",
  );

  const pageSoftDelete = await asAdmin
    .from("content_pages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", made.contentPage)
    .select("deleted_at")
    .single();
  check(
    "CONTENT PAGE soft delete",
    !pageSoftDelete.error,
    pageSoftDelete.error?.message,
  );
  await asAdmin
    .from("content_pages")
    .update({ deleted_at: null, is_published: false })
    .eq("id", made.contentPage);

  // ---------------------------------------------------------------------------
  // BANNERS — the homepage module
  // ---------------------------------------------------------------------------
  const bannerIns = await asAdmin
    .from("site_banners")
    .insert({ placement: "home_hero", display_order: 900, is_active: false })
    .select("id")
    .single();
  check(
    "BANNER create (banners.manage)",
    !bannerIns.error,
    bannerIns.error?.message,
  );
  made.banner = bannerIns.data?.id ?? null;

  const bannerTr = await asAdmin.from("banner_translations").upsert(
    ["uz", "ru", "en"].map((locale) => ({
      banner_id: made.banner,
      locale,
      title: "Banner " + locale + " " + stamp,
    })),
    { onConflict: "banner_id,locale" },
  );
  check(
    "BANNER translations written in all three languages",
    !bannerTr.error,
    bannerTr.error?.message,
  );

  const bannerPublish = await asAdmin
    .from("site_banners")
    .update({ is_active: true })
    .eq("id", made.banner)
    .select("is_active")
    .single();
  check(
    "BANNER activate",
    !bannerPublish.error && bannerPublish.data?.is_active === true,
    bannerPublish.error?.message,
  );

  const anonBanner = await anon
    .from("site_banners")
    .select("id")
    .eq("id", made.banner)
    .maybeSingle();
  check(
    "STOREFRONT sees the active banner (anonymous)",
    !anonBanner.error && anonBanner.data?.id === made.banner,
    anonBanner.error?.message ?? (anonBanner.data ? "visible" : "not visible"),
  );

  // ---------------------------------------------------------------------------
  // TEAM — administrators, roles and grants
  // ---------------------------------------------------------------------------
  const teamRead = await asAdmin
    .from("admins")
    .select("id, user_id, is_active");
  check(
    "TEAM read (admins)",
    !teamRead.error && (teamRead.data?.length ?? 0) >= 1,
    teamRead.error?.message ?? (teamRead.data?.length ?? 0) + " admins",
  );

  const rolesRead = await asAdmin.from("roles").select("id, key");
  check(
    "TEAM roles read",
    !rolesRead.error && (rolesRead.data?.length ?? 0) === 5,
    rolesRead.error?.message ?? (rolesRead.data?.length ?? 0) + " roles",
  );

  const jobTitle = await asAdmin
    .from("admins")
    .update({ job_title: "CRUD tester " + stamp })
    .eq("user_id", userId)
    .select("job_title")
    .single();
  check(
    "TEAM job title update (users.update)",
    !jobTitle.error && jobTitle.data?.job_title === "CRUD tester " + stamp,
    jobTitle.error?.message,
  );

  // A second administrator to grant a role to. Never the actor: the action
  // refuses to touch its own grants, and this proves the grant path, not that.
  const mateEmail = "mate-" + stamp + "@bondo.test";
  const mate = await admin.auth.admin.createUser({
    email: mateEmail,
    password: PASSWORD,
    email_confirm: true,
  });
  made.mateUser = mate.data?.user?.id ?? null;
  await admin
    .from("admins")
    .insert({ user_id: made.mateUser, is_active: true });

  const editorRole = (rolesRead.data ?? []).find(
    (role) => role.key === "content_editor",
  );
  const grant = await asAdmin
    .from("user_roles")
    .insert({ user_id: made.mateUser, role_id: editorRole?.id })
    .select("user_id")
    .single();
  check(
    "TEAM role granted (users.assign_roles)",
    !grant.error,
    grant.error?.message,
  );

  const grantReadBack = await asAdmin
    .from("user_roles")
    .select("role:roles(key)")
    .eq("user_id", made.mateUser);
  check(
    "TEAM grant persisted",
    grantReadBack.data?.[0]?.role?.key === "content_editor",
    grantReadBack.data?.[0]?.role?.key ?? "no grant",
  );

  const revoke = await asAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", made.mateUser)
    .eq("role_id", editorRole?.id)
    .select("user_id");
  check("TEAM role revoked", !revoke.error, revoke.error?.message);

  const disable = await asAdmin
    .from("admins")
    .update({ is_active: false })
    .eq("user_id", made.mateUser)
    .select("is_active")
    .single();
  check(
    "TEAM administrator disabled (admins.manage)",
    !disable.error && disable.data?.is_active === false,
    disable.error?.message,
  );

  // ---------------------------------------------------------------------------
  // A customer must be refused every one of these
  // ---------------------------------------------------------------------------
  const custEmail = `cust-${stamp}@bondo.test`;
  const cust = await admin.auth.admin.createUser({
    email: custEmail,
    password: PASSWORD,
    email_confirm: true,
  });
  const asCustomer = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  await asCustomer.auth.signInWithPassword({
    email: custEmail,
    password: PASSWORD,
  });

  const custWrite = await asCustomer
    .from("brands")
    .insert({ name: "Should not exist", slug: `nope-${stamp}` })
    .select("id");
  check(
    "a signed-in customer cannot create a brand (RLS)",
    custWrite.error !== null,
    custWrite.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custProduct = await asCustomer
    .from("products")
    .insert({ sku: `NOPE-${stamp}`, price_cents: 100, status: "draft" })
    .select("id");
  check(
    "a signed-in customer cannot create a product (RLS)",
    custProduct.error !== null,
    custProduct.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custCategory = await asCustomer
    .from("categories")
    .insert({ display_order: 1 })
    .select("id");
  check(
    "a signed-in customer cannot create a category (RLS)",
    custCategory.error !== null,
    custCategory.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custSetting = await asCustomer
    .from("settings")
    .update({ value: "hacked" })
    .eq("key", "store.name")
    .select("key");
  check(
    "a signed-in customer cannot change a setting (RLS)",
    custSetting.error !== null || custSetting.data?.length === 0,
    custSetting.error?.code ??
      (custSetting.data?.length ?? 0) + " row(s) updated",
  );

  const custMovement = await asCustomer
    .from("inventory_movements")
    .insert({
      product_id: made.product,
      movement_type: "purchase",
      quantity_delta: 100,
      quantity_after: 0,
    })
    .select("id");
  check(
    "a signed-in customer cannot move stock (RLS)",
    custMovement.error !== null,
    custMovement.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custPage = await asCustomer
    .from("content_pages")
    .insert({ key: "nope-" + stamp, display_order: 1 })
    .select("id");
  check(
    "a signed-in customer cannot create a content page (RLS)",
    custPage.error !== null,
    custPage.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custBanner = await asCustomer
    .from("site_banners")
    .insert({ placement: "home_hero", display_order: 1 })
    .select("id");
  check(
    "a signed-in customer cannot create a banner (RLS)",
    custBanner.error !== null,
    custBanner.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custRole = await asCustomer
    .from("user_roles")
    .insert({ user_id: made.mateUser, role_id: null })
    .select("user_id");
  check(
    "a signed-in customer cannot grant themselves a role (RLS)",
    custRole.error !== null,
    custRole.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const custAdmins = await asCustomer
    .from("admins")
    .update({ is_active: true })
    .eq("user_id", made.mateUser)
    .select("user_id");
  check(
    "a signed-in customer cannot re-enable an administrator (RLS)",
    custAdmins.error !== null || custAdmins.data?.length === 0,
    custAdmins.error?.code ??
      (custAdmins.data?.length ?? 0) + " row(s) updated",
  );

  const custPublish = await asCustomer
    .from("products")
    .update({ status: "active" })
    .eq("id", made.product)
    .select("id");
  check(
    "a signed-in customer cannot publish somebody else's product (RLS)",
    custPublish.error !== null || custPublish.data?.length === 0,
    custPublish.error?.code ??
      `${custPublish.data?.length ?? 0} row(s) updated`,
  );

  // ---------------------------------------------------------------------------
  // Anonymous — the same three mutations, with no session at all
  // ---------------------------------------------------------------------------
  // The brief asks for it explicitly, and it is the cheapest possible check that
  // the policies key off a real identity rather than merely off "not the wrong
  // one". `anon` is the same public key the storefront ships in its bundle.
  const anonProduct = await anon
    .from("products")
    .insert({ sku: `ANON-${stamp}`, price_cents: 100, status: "draft" })
    .select("id");
  check(
    "an anonymous visitor cannot create a product (RLS)",
    anonProduct.error !== null,
    anonProduct.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const anonCategory = await anon
    .from("categories")
    .insert({ display_order: 1 })
    .select("id");
  check(
    "an anonymous visitor cannot create a category (RLS)",
    anonCategory.error !== null,
    anonCategory.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const anonBrand = await anon
    .from("brands")
    .insert({ name: "Anon", slug: `anon-${stamp}` })
    .select("id");
  check(
    "an anonymous visitor cannot create a brand (RLS)",
    anonBrand.error !== null,
    anonBrand.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  const anonImage = await anon
    .from("product_images")
    .insert({ product_id: made.product, storage_path: "nope.png" })
    .select("id");
  check(
    "an anonymous visitor cannot attach a product image (RLS)",
    anonImage.error !== null,
    anonImage.error?.code ?? "INSERT SUCCEEDED — RLS HOLE",
  );

  if (cust.data?.user?.id) {
    await admin.auth.admin.deleteUser(cust.data.user.id);
  }
} catch (error) {
  check("admin CRUD run", false, error.message ?? String(error));
} finally {
  // Clean up whatever exists, in dependency order.
  for (const row of made.settingsBefore ?? []) {
    await admin
      .from("settings")
      .update({ value: row.value })
      .eq("key", row.key);
  }
  await admin
    .from("setting_translations")
    .delete()
    .eq("setting_key", "store.address")
    .like("value", "Toshkent %");
  if (made.banner) {
    await admin
      .from("banner_translations")
      .delete()
      .eq("banner_id", made.banner);
    await admin.from("site_banners").delete().eq("id", made.banner);
  }
  if (made.contentPage) {
    await admin
      .from("content_page_translations")
      .delete()
      .eq("page_id", made.contentPage);
    await admin.from("content_pages").delete().eq("id", made.contentPage);
  }
  if (made.mateUser) {
    await admin.from("user_roles").delete().eq("user_id", made.mateUser);
    await admin.from("admins").delete().eq("user_id", made.mateUser);
    await admin.auth.admin.deleteUser(made.mateUser);
  }
  if (made.upload) await admin.storage.from("products").remove([made.upload]);
  if (made.uploads.length > 0) {
    await admin.storage.from("products").remove(made.uploads);
  }
  for (const id of made.catalogProducts) {
    await admin.from("inventory").delete().eq("product_id", id);
    await admin.from("products").delete().eq("id", id);
  }
  if (made.product) {
    await admin
      .from("product_translations")
      .delete()
      .eq("product_id", made.product);
    await admin.from("inventory").delete().eq("product_id", made.product);
    await admin.from("products").delete().eq("id", made.product);
  }
  // The child first: `categories.parent_id` is `on delete restrict`, so
  // removing the parent while it has one is refused.
  if (made.childCategory) {
    await admin
      .from("category_translations")
      .delete()
      .eq("category_id", made.childCategory);
    await admin.from("categories").delete().eq("id", made.childCategory);
  }
  if (made.category) {
    await admin
      .from("category_translations")
      .delete()
      .eq("category_id", made.category);
    await admin.from("categories").delete().eq("id", made.category);
  }
  if (made.brandB) {
    await admin.from("brand_translations").delete().eq("brand_id", made.brandB);
    await admin.from("brands").delete().eq("id", made.brandB);
  }
  if (made.brand) {
    await admin.from("brand_translations").delete().eq("brand_id", made.brand);
    await admin.from("brands").delete().eq("id", made.brand);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}

console.log(results.join("\n"));
console.log(
  failures
    ? `\n${results.length - failures}/${results.length} passed — ${failures} FAILED`
    : `\nall ${results.length} live CRUD checks passed`,
);
process.exit(failures ? 1 : 0);
