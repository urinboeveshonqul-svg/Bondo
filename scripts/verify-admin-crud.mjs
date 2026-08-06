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
  brand: null,
  category: null,
  childCategory: null,
  product: null,
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

  if (cust.data?.user?.id) {
    await admin.auth.admin.deleteUser(cust.data.user.id);
  }
} catch (error) {
  check("admin CRUD run", false, error.message ?? String(error));
} finally {
  // Clean up whatever exists, in dependency order.
  if (made.upload) await admin.storage.from("products").remove([made.upload]);
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
