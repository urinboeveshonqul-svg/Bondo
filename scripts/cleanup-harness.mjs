/**
 * Removes every row left behind by `scripts/verify-admin-crud.mjs`.
 *
 * The harness names everything it creates `CRUD-<timestamp>` / `crud-…`, so the
 * prefix is the whole selector. Service role is correct here: this is
 * maintenance on rows the harness itself created, not an application path.
 */
import { createClient } from "@supabase/supabase-js";

import { harnessTarget } from "./harness-target.mjs";

/*
  Guarded like the harness it cleans up after.

  Cleaning production is the one case where reaching for the override is
  legitimate — that is how the 2026-08-14 fixtures were removed. It is still not
  the default, because a script whose normal mode is "delete rows from the live
  shop" is one bad `--like` pattern away from an incident.
*/
// `needsAnonKey` because the final check re-reads the catalog as an anonymous
// visitor — the only reading that answers "is it actually gone from the shop".
const target = harnessTarget({ name: "cleanup-harness", needsAnonKey: true });

const env = {
  NEXT_PUBLIC_SUPABASE_URL: target.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: target.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: target.serviceRoleKey,
};

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const dry = process.argv.includes("--dry");

const products = await admin
  .from("products")
  .select("id, sku")
  .like("sku", "CRUD-%");

const ids = (products.data ?? []).map((p) => p.id);
console.log(
  `products: ${ids.length}`,
  (products.data ?? []).map((p) => p.sku),
);

const orders = await admin
  .from("orders")
  .select("id, reference, status")
  .or("notes.like.crud check%,customer_name.eq.Guest Tester");
console.log(`orders: ${orders.data?.length ?? 0}`);

const pages = await admin
  .from("content_pages")
  .select("id, key")
  .like("key", "crud-page-%");
console.log(`content pages: ${pages.data?.length ?? 0}`);

const brands = await admin
  .from("brands")
  .select("id, slug")
  .like("slug", "crud-brand%");
console.log(`brands: ${brands.data?.length ?? 0}`);

if (dry) {
  console.log("dry run — nothing deleted");
  process.exit(0);
}

// Orders first: `order_items.product_id` references products.
for (const order of orders.data ?? []) {
  await admin.from("order_status_history").delete().eq("order_id", order.id);
  await admin.from("order_items").delete().eq("order_id", order.id);
  await admin.from("orders").delete().eq("id", order.id);
}

/*
  Soft delete, not a hard one.

  `inventory_movements` is append-only (ADR-24): the trigger refuses DELETE, so
  a product that has ever had a stock movement can never be removed outright —
  which is exactly why the harness's cleanup failed silently and these rows
  accumulated across runs. Soft-deleting is the schema's own answer and what
  the admin's own delete does: every storefront read filters
  `deleted_at is null`, so the shop stops showing them while the ledger keeps
  the history it exists to keep.
*/
for (const id of ids) {
  await admin.from("product_reviews").delete().eq("product_id", id);
  const del = await admin
    .from("products")
    .update({
      deleted_at: new Date().toISOString(),
      status: "draft",
      visibility: "hidden",
    })
    .eq("id", id)
    .select("id");
  if (del.error) console.log(`  ! ${id}: ${del.error.message}`);
}

for (const page of pages.data ?? []) {
  await admin.from("content_page_translations").delete().eq("page_id", page.id);
  await admin.from("content_pages").delete().eq("id", page.id);
}

for (const brand of brands.data ?? []) {
  await admin.from("brands").delete().eq("id", brand.id);
}

const categories = await admin
  .from("categories")
  .select("id")
  .like("id", "%")
  .limit(0);
void categories;

const left = await admin.from("products").select("id").like("sku", "CRUD-%");
console.log(`remaining CRUD products: ${left.data?.length ?? 0}`);

const anonLeft = await createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
)
  .from("products")
  .select("id");
console.log(
  `products an anonymous visitor can see: ${anonLeft.data?.length ?? 0}`,
);
