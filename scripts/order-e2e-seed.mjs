/**
 * One temporary purchasable product for the ordering browser test.
 *
 *   node scripts/order-e2e-seed.mjs on     create it, print the slug
 *   node scripts/order-e2e-seed.mjs off    take it out of the shop
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { harnessTarget } from "./harness-target.mjs";

// This script publishes a purchasable product. Pointed at production it puts a
// fixture in front of real shoppers, which is exactly what happened — K-26.
const target = harnessTarget({ name: "order-e2e-seed", needsAnonKey: true });

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

/*
  Pinned to the repository root, not the working directory.

  It used to be a bare `.order-e2e.json`, which resolved against wherever the
  script was invoked from. That was harmless while this file lived at the root —
  running it from its own directory *was* running it from the root. Moving it
  into `scripts/` breaks that: `on` from one directory and `off` from another
  would write and then fail to find two different files, leaving the seeded
  product in the shop with nothing recording that it exists.
*/
const STATE = fileURLToPath(new URL("../.order-e2e.json", import.meta.url));
const mode = process.argv[2];

if (mode === "on") {
  const stamp = Date.now();
  const slug = `e2e-test-${stamp}`;

  const brand = await admin
    .from("brands")
    .insert({ name: `E2E ${stamp}`, slug: `e2e-${stamp}`, is_visible: true })
    .select("id")
    .single();

  const product = await admin
    .from("products")
    .insert({
      sku: `E2E-${stamp}`,
      brand_id: brand.data.id,
      price_cents: 129900,
      status: "active",
      visibility: "public",
      warranty_months: 12,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (product.error) throw product.error;

  await admin.from("product_translations").insert(
    ["uz", "ru", "en"].map((locale) => ({
      product_id: product.data.id,
      locale,
      name: `E2E sinov mahsuloti ${stamp}`,
      slug,
      description: "Temporary product for the ordering test.",
    })),
  );

  // Stock, through the ledger — the only way `quantity_on_hand` moves.
  await admin.from("inventory_movements").insert({
    product_id: product.data.id,
    movement_type: "purchase",
    quantity_delta: 10,
    quantity_after: 0,
    reason: "e2e seed",
  });

  writeFileSync(
    STATE,
    JSON.stringify({
      productId: product.data.id,
      brandId: brand.data.id,
      slug,
      stamp,
    }),
  );
  console.log(JSON.stringify({ slug, priceCents: 129900 }));
} else if (mode === "off") {
  if (!existsSync(STATE)) throw new Error("nothing seeded");
  const state = JSON.parse(readFileSync(STATE, "utf8"));

  // Orders created by the test, found by the marker in their notes.
  const orders = await admin
    .from("orders")
    .select("id")
    .like("notes", "e2e order test%");
  for (const order of orders.data ?? []) {
    await admin.from("order_status_history").delete().eq("order_id", order.id);
    await admin.from("order_items").delete().eq("order_id", order.id);
    await admin.from("orders").delete().eq("id", order.id);
  }

  await admin
    .from("product_translations")
    .delete()
    .eq("product_id", state.productId);
  const hard = await admin
    .from("products")
    .delete()
    .eq("id", state.productId)
    .select("id");
  if (hard.error || (hard.data?.length ?? 0) === 0) {
    // Append-only ledger: soft delete is the schema's own answer.
    await admin
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        status: "draft",
        visibility: "hidden",
      })
      .eq("id", state.productId);
  }
  await admin.from("brands").delete().eq("id", state.brandId);
  unlinkSync(STATE);

  const anon = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const left = await anon.from("products").select("id");
  console.log(
    `removed. products an anonymous visitor sees: ${left.data?.length ?? 0}`,
  );
} else {
  throw new Error("usage: node scripts/order-e2e-seed.mjs on|off");
}
