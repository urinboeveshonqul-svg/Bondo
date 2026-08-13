-- Shoppers may read the stock level of a product they can already see
--
-- `inventory` had exactly two policies, both `to authenticated` and both gated
-- on `inventory.read` — a staff permission. An anonymous visitor therefore got
-- an empty embed for every product, the catalog folded that to a stock of zero,
-- and **every product on the storefront rendered "out of stock" with its Add to
-- basket button disabled**. Nothing could be bought by anybody, which is the
-- kind of failure that looks like a data problem from the outside: the row said
-- ten, the shop said none.
--
-- The scope is deliberately the narrowest thing that fixes it. `is_product_
-- published()` is the same predicate the product and translation policies use,
-- so a stock row is readable exactly when the product it belongs to is
-- readable — a draft or hidden product's inventory stays invisible, and no new
-- surface is opened on anything else.
--
-- What this does expose is the exact quantity, not merely "in stock". That is a
-- real trade and worth naming: a competitor can read how many units are on the
-- shelf. The alternative — a boolean or a bucketed view — needs a view or a
-- generated column and a second read path, and the storefront already shows a
-- low-stock indicator derived from the number, so the count is what it is
-- displaying anyway. Revisit if the business objects; the change would be a
-- view, not a widening of this policy.

create policy "inventory: anyone reads levels for published products"
  on public.inventory for select
  to anon, authenticated
  using (public.is_product_published(product_id));

comment on policy "inventory: anyone reads levels for published products"
  on public.inventory is
  'Storefront availability. Scoped by is_product_published(), so an unpublished product''s stock stays invisible.';

-- `inventory_movements` is deliberately **not** opened. A shopper needs to know
-- whether a thing is available, never the history of how it got there — that
-- ledger names suppliers, corrections and write-offs, and it stays staff-only.
