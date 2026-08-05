-- =============================================================================
-- Service highlights — the trust row under the hero
-- =============================================================================
-- Six short promises a shopper reads before deciding whether to buy from a shop
-- they have not used: warranty, build time, delivery, who assembles it, whether
-- it is tested, and whether the parts are genuine.
--
-- **They are rows, not a component.** The home page had a hardcoded
-- `ValueProps` with four claims and its copy in `messages/home.json`, which
-- meant changing a warranty period was a deploy. These are the shop's own
-- commitments and they change with the business — a promotion, a new courier, a
-- warranty extension — so they belong where an operator can edit them.
--
-- That also settles which side of ADR-39 they fall on. UI chrome lives in
-- `messages/`; content an operator authors lives on the record. "1 yillik
-- kafolat" is the shop making a promise, not the interface labelling a button.
--
-- -----------------------------------------------------------------------------
-- The icon is a name, not a file
-- -----------------------------------------------------------------------------
-- `icon` stores a lucide identifier — `ShieldCheck`, `Truck` — resolved by an
-- explicit map in the component. Not a URL and not an upload: an icon row is
-- picked from a set the design system already ships, and letting an operator
-- point at an arbitrary image is how a 900 kB PNG ends up above the fold.
--
-- The set is deliberately **not** a database enum. Adding a glyph would then be
-- a migration, and the failure mode of an unknown name is already handled — the
-- component falls back to a neutral icon rather than rendering nothing. A check
-- constraint keeps it to an identifier shape so it cannot hold markup.
-- =============================================================================

create table public.service_highlights (
  id uuid primary key default gen_random_uuid(),

  -- A lucide icon name. See the note above on why this is text.
  icon text not null default 'CircleDot',

  display_order integer not null default 0,
  is_visible boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  -- PascalCase identifier, which is what every lucide export is. Rejects an
  -- empty string, a path, and anything that could be interpolated somewhere it
  -- should not be.
  constraint service_highlights_icon_format check (icon ~ '^[A-Z][A-Za-z0-9]{1,39}$'),
  constraint service_highlights_display_order_non_negative check (display_order >= 0)
);

comment on table public.service_highlights is
  'A trust promise shown under the hero. Copy is localized in service_highlight_translations; the icon is a lucide name resolved by the component.';

comment on column public.service_highlights.icon is
  'A lucide icon name such as ShieldCheck. Not an enum, so adding a glyph is a component change rather than a migration; an unknown name falls back to a neutral icon.';

-- The storefront reads visible highlights in order, on every page view of the
-- home page. Partial, because the hidden ones are only ever read by the admin.
create index idx_service_highlights_visible
  on public.service_highlights (display_order)
  where is_visible;

create trigger service_highlights_set_updated_at
  before update on public.service_highlights
  for each row execute function public.set_updated_at();

create trigger service_highlights_set_row_actor
  before insert or update on public.service_highlights
  for each row execute function public.set_row_actor();

-- -----------------------------------------------------------------------------
-- Localized copy
-- -----------------------------------------------------------------------------
-- Keyed `(highlight, locale)` like every other translation table (ADR-51), and
-- cascading from its parent so deleting a highlight cannot orphan its copy.
create table public.service_highlight_translations (
  highlight_id uuid not null references public.service_highlights (id) on delete cascade,
  locale public.locale not null,

  title text not null,
  description text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,

  primary key (highlight_id, locale),

  constraint service_highlight_translations_title_length check (
    char_length(title) between 1 and 120
  ),
  -- Bounded because these are cards in a row, not paragraphs. A description
  -- long enough to break the grid is a data-entry mistake, and the table is
  -- where it should be refused.
  constraint service_highlight_translations_description_length check (
    char_length(description) between 1 and 400
  )
);

comment on table public.service_highlight_translations is
  'Title and description per language for one service highlight. Bounded lengths: these are cards, not articles.';

create trigger service_highlight_translations_set_updated_at
  before update on public.service_highlight_translations
  for each row execute function public.set_updated_at();

create trigger service_highlight_translations_set_row_actor
  before insert or update on public.service_highlight_translations
  for each row execute function public.set_row_actor();

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Mirrors `site_banners` exactly, and reuses its permissions: a highlight is
-- storefront content, managed by whoever manages banners. No new permission is
-- invented (ADR-44).
alter table public.service_highlights enable row level security;
alter table public.service_highlight_translations enable row level security;

create policy "service_highlights: public reads visible highlights"
  on public.service_highlights for select
  to anon, authenticated
  using (is_visible);

create policy "service_highlights: banners.read sees all"
  on public.service_highlights for select
  to authenticated
  using (public.has_permission('banners.read'));

create policy "service_highlights: banners.manage writes"
  on public.service_highlights for all
  to authenticated
  using (public.has_permission('banners.manage'))
  with check (public.has_permission('banners.manage'));

-- Readable with the highlight it belongs to. The `exists` re-runs the parent's
-- own policy, so a hidden highlight's copy is hidden with it rather than being
-- readable by anybody who knows the id.
create policy "service_highlight_translations: readable with the highlight"
  on public.service_highlight_translations for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.service_highlights h
      where h.id = service_highlight_translations.highlight_id
    )
  );

create policy "service_highlight_translations: banners.manage writes"
  on public.service_highlight_translations for all
  to authenticated
  using (public.has_permission('banners.manage'))
  with check (public.has_permission('banners.manage'));

-- =============================================================================
-- Grants
-- =============================================================================
-- Explicit and least-privilege, matching 20260801000900 (ADR-30).
grant select on public.service_highlights to anon, authenticated;
grant select on public.service_highlight_translations to anon, authenticated;

grant insert, update, delete on public.service_highlights to authenticated;
grant insert, update, delete on public.service_highlight_translations to authenticated;

-- =============================================================================
-- The six the shop opens with
-- =============================================================================
-- Reference data, not fixtures — same argument as the category taxonomy in
-- 20260810001000 (ADR-68). A shop that offers a one-year warranty says so on the
-- day it opens, and `seed.sql` never runs on `db push`.
--
-- Idempotent: skipped entirely once any highlight exists, so an operator who
-- deleted one does not get it back on the next deploy. All-or-nothing rather
-- than per-row, because "which of the defaults did they mean to keep" is not a
-- question this migration can answer.
do $$
declare
  new_id uuid;
  row_data record;
begin
  if exists (select 1 from public.service_highlights) then
    return;
  end if;

  for row_data in
    select * from (values
      (1, 'ShieldCheck',
       '1 yillik kafolat',
       'Har bir kompyuter va mahsulot 1 yillik kafolat bilan taqdim etiladi.',
       'Гарантия 1 год',
       'На каждый компьютер и товар предоставляется гарантия сроком на один год.',
       '1-Year Warranty',
       'Every computer and product comes with a one-year warranty.'),

      (2, 'Timer',
       '24 soat ichida tayyorlaymiz',
       'Buyurtmangiz tasdiqlangach, kompyuterni yig''ib, sinovdan o''tkazamiz va 24 soat ichida jo''natishga tayyorlaymiz.',
       'Сборка за 24 часа',
       'После подтверждения заказа мы собираем, тестируем компьютер и подготавливаем его к отправке в течение 24 часов.',
       'Built Within 24 Hours',
       'Once your order is confirmed, we assemble, test and prepare your computer for shipment within 24 hours.'),

      (3, 'Truck',
       'Butun O''zbekiston bo''ylab yetkazib beramiz',
       'Buyurtmalarni O''zbekistonning barcha hududlariga yetkazib beramiz. Yetkazib berish narxi manzilga qarab hisoblanadi.',
       'Доставка по всему Узбекистану',
       'Доставляем заказы во все регионы Узбекистана. Стоимость доставки зависит от адреса получателя.',
       'Nationwide Delivery',
       'We deliver across Uzbekistan. Delivery charges may vary depending on your location.'),

      (4, 'Wrench',
       'Professional yig''ish',
       'Har bir kompyuter tajribali mutaxassislar tomonidan ehtiyotkorlik bilan yig''iladi.',
       'Профессиональная сборка',
       'Каждый компьютер собирается опытными специалистами.',
       'Professional Assembly',
       'Every computer is assembled by experienced technicians.'),

      (5, 'ClipboardCheck',
       'Sinovdan o''tkazilgan',
       'Har bir kompyuter mijozga yuborilishidan oldin to''liq tekshiriladi va sinovdan o''tkaziladi.',
       'Полное тестирование',
       'Каждый компьютер проходит полное тестирование перед отправкой.',
       'Fully Tested',
       'Every computer is fully tested before shipment.'),

      (6, 'BadgeCheck',
       'Original butlovchi qismlar',
       'Kompyuterlarni faqat ishonchli va original butlovchi qismlar bilan yig''amiz.',
       'Оригинальные комплектующие',
       'Используем только оригинальные комплектующие от проверенных производителей.',
       'Genuine Components',
       'We use only genuine components from trusted manufacturers.')
    ) as t(position, icon, uz_title, uz_body, ru_title, ru_body, en_title, en_body)
    order by position
  loop
    insert into public.service_highlights (icon, display_order, is_visible)
    values (row_data.icon, row_data.position, true)
    returning id into new_id;

    insert into public.service_highlight_translations
      (highlight_id, locale, title, description)
    values
      (new_id, 'uz', row_data.uz_title, row_data.uz_body),
      (new_id, 'ru', row_data.ru_title, row_data.ru_body),
      (new_id, 'en', row_data.en_title, row_data.en_body);
  end loop;
end;
$$;
