-- Store contact settings
--
-- `services/catalog.reads.ts:getStoreContact()` reads five keys to render the
-- contact page: `store.support_email`, `store.phone`, `store.telegram`,
-- `store.address` and `store.hours`. Only the first was ever seeded
-- (20260801000500), so the other four resolved to null on every request and the
-- contact page rendered its "details not available" branch permanently — a
-- storefront page that could never show a phone number because the row it reads
-- did not exist.
--
-- This adds the four missing rows so an operator can fill them in from
-- /admin/settings. They are inserted empty rather than with invented values:
-- ADR-20 forbids placeholder data, and a fabricated address on a contact page is
-- the most damaging placeholder in the catalogue of them.
--
-- `store.address` and `store.hours` are prose a customer reads, so they are
-- flagged `is_localized` and their text lives in `setting_translations`
-- (§ 11). `store.phone` and `store.telegram` are not: a phone number is the same
-- string in all three languages, and a translated one is a wrong number.

insert into public.settings (key, value, description, is_public, is_localized)
values
  (
    'store.phone',
    'null'::jsonb,
    'Public support phone, E.164 or local format as printed. Null until configured.',
    true,
    false
  ),
  (
    'store.telegram',
    'null'::jsonb,
    'Telegram username or invite link for support. Null until configured.',
    true,
    false
  ),
  (
    'store.address',
    'null'::jsonb,
    'Shop address as it should be printed. Localized: the text lives in setting_translations.',
    true,
    true
  ),
  (
    'store.hours',
    'null'::jsonb,
    'Opening hours as prose. Localized: the text lives in setting_translations.',
    true,
    true
  )
-- `do update`, not `do nothing`.
--
-- Four of these keys already existed on the linked project — created ahead of
-- this migration, with `is_localized` left at its `false` default. `do nothing`
-- would have applied cleanly and changed none of them, so `store.address` would
-- keep reading its text from `settings.value` while the admin form wrote it to
-- `setting_translations`: saved, and invisible. Converging the flags makes the
-- migration describe the end state rather than only the insert.
on conflict (key) do update set
  is_public = excluded.is_public,
  is_localized = excluded.is_localized,
  description = excluded.description;

-- `store.currency` is deliberately **not** made editable here.
--
-- ADR-2 makes every price an integer in minor units of one store-wide currency,
-- and nothing converts. Changing the code in a settings form would relabel every
-- existing price rather than convert it — a 1 200 000 UZS laptop would silently
-- become $1,200,000. The row stays as configuration the schema records and the
-- admin panel shows read-only, and changing it stays a migration plus a
-- considered data change.
comment on column public.settings.is_localized is
  'When true the customer-facing text lives in setting_translations, one row per locale, and `value` holds null. Opt-in per key: a currency code has nothing to translate.';
