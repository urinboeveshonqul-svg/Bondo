-- An order can be retired without being destroyed
--
-- `orders` was the only customer-facing table with no way out. `products`,
-- `brands`, `categories` and the rest all carry `deleted_at` and every
-- storefront read filters on it; an order could only ever be deleted outright.
--
-- That turned out to be impossible. `order_status_history` is append-only —
-- `reject_ledger_mutation()` fires BEFORE DELETE for every role, `service_role`
-- included — and `order_status_history.order_id` references `orders` ON DELETE
-- CASCADE. So `delete from public.orders` cascades into the ledger, the trigger
-- raises `restrict_violation`, and the whole statement aborts. An order is
-- undeletable by construction, and that is the correct design: the timeline is
-- the evidence that the order happened.
--
-- The only honest way out is the one the rest of the schema already uses. This
-- adds it, and nothing else: no trigger changes, no policy changes, no foreign
-- key changes, and no edit to a single existing row.
--
-- **The ledger stays.** A retired order keeps its `order_status_history` rows.
-- That is deliberate rather than an omission — retiring an order is not a claim
-- that it never happened, and the append-only guard exists precisely so nobody
-- can make that claim.

alter table public.orders
  add column deleted_at timestamptz;

comment on column public.orders.deleted_at is
  'Set to retire an order from every normal read. Never used to erase one: the order row and its append-only order_status_history timeline both remain. Reads filter `deleted_at is null`; the admin `orders.read` policy still returns retired rows so support can look one up.';

-- The admin list is `order by placed_at desc` over live orders only, and orders
-- is the one table here that grows every day without anybody curating it. A
-- partial index keeps that query on the live set instead of walking retired
-- rows it will discard.
create index idx_orders_placed_at_live
  on public.orders (placed_at desc)
  where deleted_at is null;

-- RLS is deliberately NOT changed.
--
-- `orders: orders.read sees every order` must keep returning retired orders —
-- support answering "what happened to BND-001003" needs to find it, and a
-- policy that hides it turns a retired order into a missing one.
--
-- `orders: a customer reads their own` is left alone for the same reason it is
-- safe to: the service layer filters `deleted_at is null` on every customer
-- path, so a retired order is already unreachable through the application, and
-- narrowing the policy would silently change what `claim_orders` can attach.
-- If that trade is ever revisited, it belongs in its own migration with its own
-- reasoning, not smuggled into a column addition.
