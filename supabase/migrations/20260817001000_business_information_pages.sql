-- =============================================================================
-- The five business-information pages, and somewhere to put contact details
-- =============================================================================
-- Delivery, warranty, returns, contact and about — the pages the footer has
-- been unable to link since Phase 3A, because `content_pages` existed and held
-- no rows.
--
-- **This is the business's own information, not invented content.** Everything
-- below was supplied by the business: the carriers, the 24-hour preparation
-- window, the three-day delivery estimate, the fact that delivery is charged
-- separately, and the one-year warranty. ADR-20 forbids *fake* data; a shop's
-- own delivery policy is the opposite of fake, and it belongs with the roles,
-- permissions and category taxonomy that ship the same way (ADR-68, ADR-72).
--
-- -----------------------------------------------------------------------------
-- What is deliberately NOT written here
-- -----------------------------------------------------------------------------
-- The returns page states that the policy is not finalised and asks the customer
-- to get in touch. That is the honest version, and it is a decision rather than
-- an omission: a return window is a legal commitment, and inventing "14 days"
-- would bind the business to something nobody agreed. The same applies to the
-- warranty's detailed conditions — the duration is known and stated, the
-- exclusions are not.
--
-- Privacy and terms pages are **not created at all**. Boilerplate legal text
-- that nobody has approved is worse than a missing page, because a missing page
-- is visibly missing.
--
-- -----------------------------------------------------------------------------
-- The body format
-- -----------------------------------------------------------------------------
-- `body` is plain text in a documented minimal syntax (**ADR-76**): `## ` starts
-- a section heading, `- ` starts a list item, and a blank line separates
-- paragraphs. Not HTML, because HTML from the database is markup an editor can
-- inject; not Markdown, because a parser would be a dependency for three block
-- types. `components/content/content-body.tsx` renders exactly this and nothing
-- else.
--
-- -----------------------------------------------------------------------------
-- Three languages, written three times
-- -----------------------------------------------------------------------------
-- Not one text translated twice (CLAUDE.md § 11a). The Uzbek was written first,
-- then the Russian and English were written from the same facts — so the section
-- counts, the headings, the sentence shapes and the paragraph lengths differ
-- between them, which is what independent writing produces and translation does
-- not.
--
-- -----------------------------------------------------------------------------
-- Idempotent
-- -----------------------------------------------------------------------------
-- Keyed on `content_pages.key`. Re-running inserts nothing, and copy an editor
-- has since rewritten in the admin is left alone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Contact details have nowhere to live yet
-- -----------------------------------------------------------------------------
-- `settings` already carries `store.support_email`, null and public. These four
-- follow it exactly: declared, public, and **null**, because the business has
-- not given them. A null row is not a placeholder — it is the field existing and
-- being unconfigured, which is what lets the contact page say "this is not set
-- up yet" instead of the developer guessing a phone number.
--
-- `is_public` matters: the storefront reads settings with the anon key, and RLS
-- returns only the public subset. A private row would be invisible to the very
-- page that needs it.
insert into public.settings (key, value, description, is_public) values
  ('store.phone',    'null'::jsonb, 'Public sales phone number, E.164 or local format. Null until configured.', true),
  ('store.telegram', 'null'::jsonb, 'Public Telegram username without the @. Null until configured.',           true),
  ('store.address',  'null'::jsonb, 'Public street address of the shop. Null until configured.',                true),
  ('store.hours',    'null'::jsonb, 'Public opening hours, free text. Null until configured.',                  true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- The pages
-- -----------------------------------------------------------------------------
create temporary table _pages (
  key text,
  display_order integer
) on commit drop;

insert into _pages values
  ('delivery', 1),
  ('warranty', 2),
  ('returns',  3),
  ('contact',  4),
  ('about',    5);

insert into public.content_pages (key, display_order, is_published, published_at)
select key, display_order, true, now()
from _pages
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Copy
-- -----------------------------------------------------------------------------
-- One temporary table so the insert below reads once instead of fifteen times.
-- `slug` is left null: these pages are reached at a fixed path per key
-- (`/delivery`, `/warranty`, …) in every language, which is what the business
-- asked for, so there is no per-locale slug to store.
create temporary table _page_copy (
  key text,
  locale public.locale,
  title text,
  excerpt text,
  body text
) on commit drop;

-- === Delivery =================================================================
insert into _page_copy values
  ('delivery', 'uz',
   'Yetkazib berish',
   'Bondo O''zbekistonning barcha hududlariga mahsulot yuboradi.',
   '## Qanday yetkazamiz

Mahsulotlarni pochta va kuryerlik xizmatlari orqali jo''natamiz:

- BTS
- EMU
- O''zbekiston pochtasi
- hududingizda ishlaydigan boshqa xizmatlar

Qaysi xizmat orqali ketishi manzilingizga va o''sha yerda mavjud imkoniyatga bog''liq.

## Buyurtma qachon jo''natiladi

Buyurtma tasdiqlangandan keyin mahsulot 24 soat ichida jo''natishga tayyorlanadi.

## Qancha vaqtda yetib boradi

Jo''natilgandan so''ng buyurtma odatda ko''pi bilan 3 kunda yetib boradi. Aniq muddat manzilga va tanlangan xizmatga qarab o''zgaradi.

## Narxi

Yetkazib berish alohida to''lanadi. Summa manzilingizga va tanlangan xizmatga qarab hisoblanadi. Menejer buyurtmani tasdiqlash uchun qo''ng''iroq qilganda aniq narxni aytadi.

## Taksi orqali jo''natish

Shoshilinch bo''lsa va hududingizda imkoni bo''lsa, buyurtmani taksi yoki kuryer orqali ham jo''natamiz. Buyurtma berayotganda shuni aytib qo''ying.

## Savolingiz qoldimi

Yetkazib berish bo''yicha aniqlik kiritish kerak bo''lsa, biz bilan bog''laning.'),

  ('delivery', 'ru',
   'Доставка',
   'Отправляем заказы во все регионы Узбекистана.',
   '## Чем отправляем

Заказы везут почтовые и курьерские службы — BTS, EMU, «Узбекистон почтаси», а также другие компании, которые работают в вашем регионе. Какая именно повезёт ваш заказ, зависит от адреса и от того, что доступно в вашем городе.

## Когда отправим

Собираем заказ и передаём в доставку в течение 24 часов после подтверждения.

## Сроки

После отправки заказ обычно приходит не позже чем через 3 дня. Точный срок зависит от региона и службы доставки.

## Стоимость

Доставка оплачивается отдельно. Сумму считаем по вашему адресу и выбранной службе — менеджер назовёт её во время звонка, когда будет подтверждать заказ.

## Если нужно быстрее

Когда время критично, а в вашем городе есть такая возможность, отправим заказ такси или курьером. Скажите об этом при оформлении.

## Остались вопросы

Свяжитесь с нами — подскажем по доставке в ваш город.'),

  ('delivery', 'en',
   'Delivery',
   'We ship anywhere in Uzbekistan.',
   '## How your order travels

Orders go out through postal and courier companies — BTS, EMU, UzPost, and whichever other services run where you are. Which one carries your parcel comes down to your address and what operates there.

## Getting it out the door

Once your order is confirmed, we have it packed and handed over within 24 hours.

## How long it takes

Most orders arrive within three days of dispatch. Distance and the carrier decide the rest.

## What it costs

Delivery is charged on top of the order. The amount depends on where you are and which service carries it, and we tell you the figure on the confirmation call.

## Need it sooner

Where it is available, we can send your order by taxi or with a local courier instead. Just say so when you order.

## Anything unclear

Get in touch and we will talk it through.');

-- === Warranty =================================================================
insert into _page_copy values
  ('warranty', 'uz',
   'Kafolat',
   'Bondo sotadigan mahsulotlarga 1 yil rasmiy kafolat beriladi.',
   '## 1 yil rasmiy kafolat

Bondoda sotib olingan mahsulotlarga rasmiy kafolat amal qiladi. Kafolat muddati — 1 yil.

## Kafolat qanday amal qiladi

Kafolat mahsulot turiga qarab qo''llaniladi. O''zingiz olgan mahsulotga aynan qanday shartlar tegishli ekanini bilmoqchi bo''lsangiz, biz bilan bog''laning: buyurtma raqamini aytsangiz, tekshirib aytamiz.

## Mahsulotda nuqson chiqsa

Avval biz bilan bog''laning. Nima bo''lganini tushuntiring va buyurtma raqamingizni tayyorlab qo''ying. Keyingi qadamlarni birga hal qilamiz.

## To''liq shartlar

Kafolatning batafsil shartlari hozircha bu sahifada e''lon qilinmagan. Aniqlik kerak bo''lsa, to''g''ridan-to''g''ri bizga murojaat qiling.'),

  ('warranty', 'ru',
   'Гарантия',
   'На товары, купленные в Bondo, действует официальная гарантия 1 год.',
   '## Официальная гарантия 1 год

Товары, купленные в Bondo, обеспечены официальной гарантией сроком на один год.

## Как это работает

Условия зависят от типа товара. Хотите узнать, что именно распространяется на вашу покупку, — напишите нам и назовите номер заказа, мы проверим и ответим.

## Что делать при неисправности

Сначала свяжитесь с нами: опишите, что произошло, и держите под рукой номер заказа. Дальше разберёмся вместе.

## Подробные условия

Полный текст гарантийных условий на этой странице пока не опубликован. Если нужна конкретика, обратитесь к нам напрямую.'),

  ('warranty', 'en',
   'Warranty',
   'Everything Bondo sells carries a one-year official warranty.',
   '## One-year official warranty

Products bought from Bondo come with an official warranty. The term is one year.

## What it covers

Cover depends on the type of product. If you want to know exactly what applies to something you bought, message us with your order number and we will check it for you.

## If something goes wrong

Talk to us first. Tell us what happened and have your order number ready — we will take it from there.

## The detailed terms

The full warranty conditions are not published on this page yet. When you need specifics, ask us directly.');

-- === Returns ==================================================================
insert into _page_copy values
  ('returns', 'uz',
   'Mahsulotni qaytarish',
   'Qaytarish yoki almashtirish bo''yicha biz bilan bog''laning.',
   '## Hozircha nimasi ma''lum

Mahsulotni qaytarish va almashtirish tartibi hujjat sifatida hali yakunlanmagan. Shuning uchun bu yerda muddat ham, shart ham yozilmagan: noto''g''ri ma''lumot berishdan ko''ra, to''g''ridan-to''g''ri gaplashgan yaxshiroq.

## Nima qilish kerak

Olgan mahsulotingizni qaytarmoqchi bo''lsangiz yoki unda nuqson chiqqan bo''lsa, biz bilan bog''laning. Buyurtma raqamini va muammo nimadaligini ayting.

## Keyin nima bo''ladi

Har bir murojaatni alohida ko''rib chiqamiz va nima qilish mumkinligini sizga aytamiz.'),

  ('returns', 'ru',
   'Возврат товара',
   'По возврату и обмену — свяжитесь с нами.',
   '## Что известно сейчас

Порядок возврата и обмена ещё не оформлен документом, поэтому мы не указываем здесь ни сроков, ни условий. Написать наугад было бы хуже, чем честно сказать: этот вопрос решается в разговоре.

## Как поступить

Хотите вернуть покупку или в товаре обнаружился дефект — напишите нам. Понадобится номер заказа и описание проблемы.

## Что дальше

Каждое обращение рассматриваем отдельно и говорим, какие варианты есть в вашем случае.'),

  ('returns', 'en',
   'Returns',
   'Get in touch about a return or an exchange.',
   '## Where this stands

Our returns and exchange policy is not written up yet, so you will not find a window or a set of conditions on this page. Publishing a number nobody has agreed to would be worse than saying plainly that this one gets sorted out in conversation.

## What to do

If you want to send something back, or a product turned out to be faulty, contact us. Have your order number and a short description of the problem ready.

## What happens next

We look at each case on its own and tell you what your options are.');

-- === Contact ==================================================================
-- The page renders the configured contact details above this copy; the body is
-- what stays true whether or not a phone number has been set.
insert into _page_copy values
  ('contact', 'uz',
   'Aloqa',
   'Buyurtma, yetkazib berish yoki kafolat bo''yicha savollaringizga javob beramiz.',
   '## Nima haqida yozsangiz bo''ladi

Mahsulot tanlash, buyurtma holati, yetkazib berish, kafolat yoki qaytarish — barchasi bo''yicha murojaat qilishingiz mumkin.

## Buyurtma bergan bo''lsangiz

Buyurtmangiz holatini shaxsiy kabinetdagi buyurtmalar bo''limidan ko''rasiz. Murojaat qilganingizda buyurtma raqamini aytsangiz, tezroq yordam beramiz.

## Kompyuter yig''ish

Kompyuterni o''zimiz yig''amiz. Qanday ish uchun kerakligini ayting — qismlarni birga tanlaymiz.'),

  ('contact', 'ru',
   'Контакты',
   'Ответим по заказу, доставке и гарантии.',
   '## С чем можно обращаться

Подбор товара, статус заказа, доставка, гарантия, возврат — пишите по любому из этих вопросов.

## Если заказ уже оформлен

Статус видно в личном кабинете, в разделе заказов. Назовите номер заказа при обращении — так мы ответим быстрее.

## Сборка компьютера

Компьютеры собираем сами. Расскажите, для каких задач нужен, и подберём комплектацию вместе.'),

  ('contact', 'en',
   'Contact us',
   'Questions about an order, delivery or warranty — this is the place.',
   '## What we can help with

Choosing a product, checking an order, delivery, warranty, returns. Any of it.

## Already ordered

Your order status is in your account, under orders. Quote the order number when you write and we will get to an answer faster.

## Custom builds

We build PCs in house. Tell us what you need it for and we will pick the parts with you.');

-- === About ====================================================================
insert into _page_copy values
  ('about', 'uz',
   'Bondo haqida',
   'Kompyuter, noutbuk va kompyuter qismlari sotamiz hamda kompyuter yig''amiz.',
   '## Nima sotamiz

Bondoda kompyuter va noutbuklar, monobloklar, monitorlar, kompyuter qismlari va aksessuarlar bor. Tayyor kompyuterlarni ham sotamiz.

## Kompyuterni o''zimiz yig''amiz

Kompyuterlarni o''z ustaxonamizda yig''amiz. Qanday ish uchun kerakligini ayting — o''yin, ish yoki o''qish uchunmi — shunga qarab qismlarni birga tanlaymiz.

## Buyurtma qanday ketadi

Buyurtma tasdiqlangandan keyin mahsulot 24 soat ichida jo''natishga tayyorlanadi. O''zbekistonning barcha hududlariga yuboramiz.

## Kafolat

Sotgan mahsulotlarimizga 1 yil rasmiy kafolat beriladi.'),

  ('about', 'ru',
   'О Bondo',
   'Продаём компьютеры, ноутбуки и комплектующие, а также собираем компьютеры.',
   '## Чем занимаемся

В Bondo можно купить компьютер или ноутбук, моноблок, монитор, комплектующие и аксессуары. Готовые сборки тоже есть.

## Сборка

Компьютеры собираем у себя. Скажите, для чего он нужен — для игр, для работы или для учёбы, — и подберём комплектующие под эту задачу.

## Как проходит заказ

После подтверждения заказ готовим к отправке в течение 24 часов и отправляем в любой регион Узбекистана.

## Гарантия

На проданные товары действует официальная гарантия 1 год.'),

  ('about', 'en',
   'About Bondo',
   'We sell computers, laptops and PC parts, and we build machines ourselves.',
   '## What we sell

Computers and laptops, all-in-ones, monitors, PC components and accessories. Prebuilt machines too.

## We build them here

PCs are assembled in our own workshop. Tell us what the machine is for — gaming, work, study — and we will pick the parts with you.

## How an order goes

After you confirm an order we have it ready to ship inside 24 hours, and we deliver anywhere in Uzbekistan.

## Warranty

Everything we sell carries a one-year official warranty.');

-- -----------------------------------------------------------------------------
-- Insert the copy, skipping anything already written
-- -----------------------------------------------------------------------------
insert into public.content_page_translations (page_id, locale, title, excerpt, body)
select p.id, c.locale, c.title, c.excerpt, c.body
from _page_copy c
join public.content_pages p on p.key = c.key
on conflict (page_id, locale) do nothing;
