-- =============================================================================
-- DEVELOPMENT SEED — NOT FOR PRODUCTION
-- =============================================================================
-- Run automatically by `supabase db reset` against the LOCAL stack only
-- (`[db.seed]` in config.toml). It is never part of `supabase db push`, so it
-- cannot reach a hosted project through the normal migration path.
--
-- That is a convention, and conventions get broken by tired people at 6pm, so
-- the guard below is a mechanism: the script aborts if the database already
-- holds products or admins. Pointing it at a live store fails loudly instead of
-- injecting fixtures into a real catalog.
--
-- This file exists as a deliberate, recorded refinement of ADR-20 ("no fake or
-- seeded data"). The original reasoning still stands for anything the
-- storefront ships — empty states are where ecommerce UIs break, and shipped
-- placeholder content hides them. A local fixture that never leaves a developer
-- machine is a different thing, and Phase 2 has no UI for it to hide. See
-- ADR-25.
--
-- The admin credential below is a LOCAL DEVELOPMENT credential. It is
-- deliberately committed, deliberately weak, and works only against a database
-- seeded by this file.
--
--   email:    admin@bondo.local
--   password: bondo-dev-password
--
-- =============================================================================

do $$
begin
  if exists (select 1 from public.products limit 1)
     or exists (select 1 from public.admins limit 1) then
    raise exception
      'Refusing to seed: this database already contains products or admins.'
      using hint = 'The development seed is only for an empty local database. Run `npm run db:reset` to start clean.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Development admin account
-- -----------------------------------------------------------------------------
-- Written straight into auth.users because there is no local signup UI in this
-- phase. The identities row is required for password sign-in to work; GoTrue
-- looks the credential up there, not on the user row.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'admin@bondo.local',
  extensions.crypt('bondo-dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Development Admin"}'::jsonb,
  now(),
  now(),
  '', '', '', ''
);

insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '{"sub":"00000000-0000-4000-8000-000000000001","email":"admin@bondo.local","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now(),
  now()
);

-- The profile row arrives via the on_auth_user_created trigger. Promote the
-- account to staff and give it every capability.
insert into public.admins (user_id, job_title, is_active)
values ('00000000-0000-4000-8000-000000000001', 'Development administrator', true);

insert into public.user_roles (user_id, role_id)
select '00000000-0000-4000-8000-000000000001', r.id
from public.roles r
where r.key = 'super_admin';

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------
-- Three levels, to exercise the nesting trigger rather than to be a finished
-- taxonomy. Ids are fixed so later inserts can reference them without lookups.
insert into public.categories (
  id, parent_id, display_order
) values
  ('a0000000-0000-4000-8000-000000000001', null, 1),
  ('a0000000-0000-4000-8000-000000000002', null, 2),
  ('a0000000-0000-4000-8000-000000000003', null, 3),
  ('a0000000-0000-4000-8000-000000000004', null, 4);

-- English copy for the rows above. Uzbek and Russian are written in
-- the admin; a seed that invented them would be fake data (ADR-20).
insert into public.category_translations (
  category_id, locale, name, description, slug
) values
  ('a0000000-0000-4000-8000-000000000001', 'en', 'Laptops', 'Portable computers.', 'laptops'),
  ('a0000000-0000-4000-8000-000000000002', 'en', 'Desktops', 'Tower and small-form-factor systems.', 'desktops'),
  ('a0000000-0000-4000-8000-000000000003', 'en', 'Components', 'Parts for building and upgrading.', 'components'),
  ('a0000000-0000-4000-8000-000000000004', 'en', 'Peripherals', 'Everything you plug in.', 'peripherals');

insert into public.categories (
  id, parent_id, display_order
) values
  ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 1),
  ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 2),
  ('a0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000003', 1),
  ('a0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000003', 2),
  ('a0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000003', 3),
  ('a0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000004', 1),
  ('a0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000004', 2);

-- English copy for the rows above. Uzbek and Russian are written in
-- the admin; a seed that invented them would be fake data (ADR-20).
insert into public.category_translations (
  category_id, locale, name, slug
) values
  ('a0000000-0000-4000-8000-000000000011', 'en', 'Gaming laptops', 'gaming-laptops'),
  ('a0000000-0000-4000-8000-000000000012', 'en', 'Ultrabooks', 'ultrabooks'),
  ('a0000000-0000-4000-8000-000000000021', 'en', 'Graphics cards', 'graphics-cards'),
  ('a0000000-0000-4000-8000-000000000022', 'en', 'Processors', 'processors'),
  ('a0000000-0000-4000-8000-000000000023', 'en', 'Memory', 'memory'),
  ('a0000000-0000-4000-8000-000000000031', 'en', 'Keyboards', 'keyboards'),
  ('a0000000-0000-4000-8000-000000000032', 'en', 'Monitors', 'monitors');

-- Third level, so `depth = 2` and the descendant rebuild are both exercised.
insert into public.categories (
  id, parent_id, display_order
) values
  ('a0000000-0000-4000-8000-000000000211', 'a0000000-0000-4000-8000-000000000021', 1),
  ('a0000000-0000-4000-8000-000000000212', 'a0000000-0000-4000-8000-000000000021', 2);

-- English copy for the rows above. Uzbek and Russian are written in
-- the admin; a seed that invented them would be fake data (ADR-20).
insert into public.category_translations (
  category_id, locale, name, slug
) values
  ('a0000000-0000-4000-8000-000000000211', 'en', 'NVIDIA', 'nvidia-graphics-cards'),
  ('a0000000-0000-4000-8000-000000000212', 'en', 'AMD', 'amd-graphics-cards');

-- -----------------------------------------------------------------------------
-- Brands
-- -----------------------------------------------------------------------------
insert into public.brands (
  id, slug, name, website_url, is_featured
) values
  ('b0000000-0000-4000-8000-000000000001', 'nvidia', 'NVIDIA', 'https://www.nvidia.com', true),
  ('b0000000-0000-4000-8000-000000000002', 'amd', 'AMD', 'https://www.amd.com', true),
  ('b0000000-0000-4000-8000-000000000003', 'intel', 'Intel', 'https://www.intel.com', false),
  ('b0000000-0000-4000-8000-000000000004', 'corsair', 'Corsair', 'https://www.corsair.com', false),
  ('b0000000-0000-4000-8000-000000000005', 'lenovo', 'Lenovo', 'https://www.lenovo.com', false);

-- English copy for the rows above. Uzbek and Russian are written in
-- the admin; a seed that invented them would be fake data (ADR-20).
insert into public.brand_translations (
  brand_id, locale, description
) values
  ('b0000000-0000-4000-8000-000000000001', 'en', 'Graphics processors.'),
  ('b0000000-0000-4000-8000-000000000002', 'en', 'Processors and graphics.'),
  ('b0000000-0000-4000-8000-000000000003', 'en', 'Processors.'),
  ('b0000000-0000-4000-8000-000000000004', 'en', 'Memory and peripherals.'),
  ('b0000000-0000-4000-8000-000000000005', 'en', 'Laptops and desktops.');

-- -----------------------------------------------------------------------------
-- Sample products
-- -----------------------------------------------------------------------------
-- Deliberately few, and deliberately varied: one draft, one hidden, one
-- scheduled for the future, one on sale. Uniform fixtures would make every RLS
-- policy look like it works.
insert into public.products (
  id, sku, brand_id, category_id, status, visibility, is_featured, price_cents, sale_price_cents, cost_price_cents, weight_grams, length_mm, width_mm, height_mm, warranty_months, published_at
) values
  ('c0000000-0000-4000-8000-000000000001', 'GPU-RTX4090-FE', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000211', 'active', 'public', true, 159900, 149900, 120000, 2186, 304, 137, 61, 36, now() - interval '30 days'),
  ('c0000000-0000-4000-8000-000000000002', 'CPU-R9-7950X', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000022', 'active', 'public', true, 69900, null, 52000, 120, 40, 40, 7, 36, now() - interval '14 days'),
  ('c0000000-0000-4000-8000-000000000003', 'MEM-CORS-32GB-DDR5', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000023', 'active', 'public', false, 14900, 12900, 9800, 96, 133, 34, 7, 60, now() - interval '7 days'),
  ('c0000000-0000-4000-8000-000000000004', 'LAP-LEN-X1C-G12', 'b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000012', 'draft', 'public', false, 189900, null, 150000, 1090, 313, 215, 15, 36, null),
  ('c0000000-0000-4000-8000-000000000005', 'GPU-RX7900XTX', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000212', 'active', 'hidden', false, 99900, null, 78000, 1960, 287, 135, 51, 24, now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000006', 'KEY-CORS-K70', 'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000031', 'active', 'public', false, 16900, null, 11000, 1150, 444, 166, 40, 24, now() + interval '7 days');

-- English copy for the rows above. Uzbek and Russian are written in
-- the admin; a seed that invented them would be fake data (ADR-20).
insert into public.product_translations (
  product_id, locale, name, short_description, description, slug, seo_keywords
) values
  ('c0000000-0000-4000-8000-000000000001', 'en', 'NVIDIA GeForce RTX 4090 Founders Edition', 'Flagship graphics card with 24GB of GDDR6X memory.', 'The RTX 4090 Founders Edition is built for 4K gaming and GPU compute workloads.', 'nvidia-geforce-rtx-4090-founders-edition', array['rtx', '4090', 'nvidia', 'graphics card', 'gpu']),
  ('c0000000-0000-4000-8000-000000000002', 'en', 'AMD Ryzen 9 7950X', '16-core desktop processor on socket AM5.', 'Sixteen Zen 4 cores at up to 5.7GHz.', 'amd-ryzen-9-7950x', array['ryzen', '7950x', 'amd', 'cpu', 'processor']),
  ('c0000000-0000-4000-8000-000000000003', 'en', 'Corsair Vengeance 32GB DDR5-6000', 'Two 16GB modules rated for 6000 MT/s.', 'DDR5 kit with on-die ECC and an aluminium heat spreader.', 'corsair-vengeance-32gb-ddr5-6000', array['ddr5', 'corsair', 'memory', 'ram', '32gb']),
  ('c0000000-0000-4000-8000-000000000004', 'en', 'Lenovo ThinkPad X1 Carbon Gen 12', 'Fourteen-inch business ultrabook.', 'Still being photographed — not ready to publish.', 'lenovo-thinkpad-x1-carbon-gen-12', array['thinkpad', 'x1 carbon', 'lenovo', 'ultrabook']),
  ('c0000000-0000-4000-8000-000000000005', 'en', 'AMD Radeon RX 7900 XTX', 'High-end graphics card with 24GB of GDDR6.', 'Temporarily hidden while the product photography is redone.', 'amd-radeon-rx-7900-xtx', array['radeon', '7900 xtx', 'amd', 'gpu']),
  ('c0000000-0000-4000-8000-000000000006', 'en', 'Corsair K70 RGB Mechanical Keyboard', 'Mechanical keyboard with an aluminium frame.', 'Launches next week.', 'corsair-k70-rgb-mechanical-keyboard', array['corsair', 'k70', 'keyboard', 'mechanical']);

-- -----------------------------------------------------------------------------
-- Specifications
-- -----------------------------------------------------------------------------
insert into public.product_specifications (product_id, spec_group, name, value, unit, display_order) values
  ('c0000000-0000-4000-8000-000000000001', 'Memory',      'Capacity',       '24',    'GB',  1),
  ('c0000000-0000-4000-8000-000000000001', 'Memory',      'Type',           'GDDR6X', null, 2),
  ('c0000000-0000-4000-8000-000000000001', 'Power',       'Board power',    '450',   'W',   1),
  ('c0000000-0000-4000-8000-000000000001', 'Connectivity','Display outputs','3x DisplayPort 1.4a, 1x HDMI 2.1', null, 1),
  ('c0000000-0000-4000-8000-000000000002', 'Cores',       'Core count',     '16',    null,  1),
  ('c0000000-0000-4000-8000-000000000002', 'Cores',       'Thread count',   '32',    null,  2),
  ('c0000000-0000-4000-8000-000000000002', 'Clocks',      'Boost clock',    '5.7',   'GHz', 1),
  ('c0000000-0000-4000-8000-000000000003', 'Memory',      'Capacity',       '32',    'GB',  1),
  ('c0000000-0000-4000-8000-000000000003', 'Memory',      'Speed',          '6000',  'MT/s',2);

-- -----------------------------------------------------------------------------
-- Opening stock
-- -----------------------------------------------------------------------------
-- Through the ledger, because that is the only way stock can move. Writing to
-- inventory.quantity_on_hand directly here would be rejected by the guard
-- trigger — which is the point of having it.
insert into public.inventory_movements (product_id, movement_type, quantity_delta, reason, reference) values
  ('c0000000-0000-4000-8000-000000000001', 'purchase',   12, 'Opening stock', 'PO-DEV-0001'),
  ('c0000000-0000-4000-8000-000000000002', 'purchase',   40, 'Opening stock', 'PO-DEV-0001'),
  ('c0000000-0000-4000-8000-000000000003', 'purchase',  150, 'Opening stock', 'PO-DEV-0002'),
  ('c0000000-0000-4000-8000-000000000005', 'purchase',    8, 'Opening stock', 'PO-DEV-0002'),
  ('c0000000-0000-4000-8000-000000000006', 'purchase',   25, 'Pre-launch stock', 'PO-DEV-0003');

-- A correction, so the ledger shows more than one movement type and the
-- history view has something to display.
insert into public.inventory_movements (product_id, movement_type, quantity_delta, reason) values
  ('c0000000-0000-4000-8000-000000000001', 'correction', -2, 'Stock count: two units damaged in transit');

-- Low-stock thresholds, so the reorder report returns something.
update public.inventory set low_stock_threshold = 5
where product_id in (
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000005'
);

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
-- The migration inserts the structural keys. Here only the local-only values
-- are filled in.
update public.settings set value = '"support@bondo.local"'::jsonb where key = 'store.support_email';
update public.settings set value = '"stock@bondo.local"'::jsonb  where key = 'orders.low_stock_email';

-- -----------------------------------------------------------------------------
-- Banner
-- -----------------------------------------------------------------------------
-- The banner and its English copy. `returning` keys the translation to the row
-- just inserted, so no id has to be invented here or kept in step by hand.
with banner as (
  insert into public.site_banners (
    placement, link_url, is_active, display_order
  ) values
    ('home_hero', '/products', true, 1)
  returning id
)
insert into public.banner_translations (banner_id, locale, title, subtitle)
select
  banner.id,
  'en',
  'Components chosen on merit, not margin',
  'Every system we build is assembled, cable-managed and burned in for 24 hours before it ships.'
from banner;
