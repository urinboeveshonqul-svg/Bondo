-- =============================================================================
-- Social and canonical metadata on the translation rows
-- =============================================================================
-- The admin architecture refactor gives every module one reusable SEO panel,
-- and the brief specifies its fields: title, description, keywords, slug,
-- canonical, Open Graph and Twitter. The first four already exist on the
-- translation rows (`20260804001000_localization.sql`). The last three do not.
--
-- CLAUDE.md § 12 decides the order of work: the schema must be able to store
-- what the screen collects **before** the screen collects it. Building the
-- panel first would produce exactly K-15 again — a form with three fields that
-- have nowhere to go.
--
-- These columns live on the *translation* row, not the parent, for the same
-- reason `seo_title` does: a share card carries a headline and usually an image
-- with words baked into it, and both read differently in each language.
--
-- -----------------------------------------------------------------------------
-- The fallback chain, and why there are five columns rather than nine
-- -----------------------------------------------------------------------------
-- A naive model gives Open Graph and Twitter their own title and description,
-- which is four more columns per table and, in practice, four more copies of
-- the same sentence that drift apart. The resolution order is instead:
--
--     twitter:title       → og_title → seo_title → name
--     twitter:description → og_description → seo_description → description
--     twitter:image       → og_image_path
--
-- so a store that writes nothing here still emits complete cards, and a store
-- that wants a punchier share headline overrides one field. `twitter_card`
-- exists as its own column because it is the one thing Twitter does not infer:
-- a large image and a small one are a layout choice, not a copy choice.
--
-- The chain is resolved in the service layer, not here, because a generated
-- column cannot reach across to the parent table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- twitter_card
-- -----------------------------------------------------------------------------
-- An enum rather than free text, so `Enums<"twitter_card">` reaches the UI and
-- the select cannot offer a value the insert rejects (CLAUDE.md § 12). Only the
-- two card types a store page can legitimately be are included: `app` and
-- `player` describe things a catalog does not sell.
create type public.twitter_card as enum ('summary', 'summary_large_image');

comment on type public.twitter_card is
  'Twitter/X card layout. Null on a translation row means inherit the store default.';

-- -----------------------------------------------------------------------------
-- The shared column set
-- -----------------------------------------------------------------------------
-- Four tables get the same five columns. `banner_translations` and
-- `setting_translations` do not: neither is a page, so neither has a canonical
-- URL or a share card of its own.

alter table public.product_translations
  add column canonical_url text,
  add column og_title text,
  add column og_description text,
  add column og_image_path text,
  add column twitter_card public.twitter_card;

alter table public.category_translations
  add column canonical_url text,
  add column og_title text,
  add column og_description text,
  add column og_image_path text,
  add column twitter_card public.twitter_card;

alter table public.brand_translations
  add column canonical_url text,
  add column og_title text,
  add column og_description text,
  add column og_image_path text,
  add column twitter_card public.twitter_card;

alter table public.content_page_translations
  add column canonical_url text,
  add column og_title text,
  add column og_description text,
  add column og_image_path text,
  add column twitter_card public.twitter_card;

-- -----------------------------------------------------------------------------
-- Constraints
-- -----------------------------------------------------------------------------
-- A canonical URL that is not absolute is worse than none: a relative value
-- resolves against whichever page emitted it, so every locale of every product
-- would declare itself canonical for a different address. The scheme check is
-- the same restriction `lib/env.ts` applies to environment URLs, and for the
-- same reason — `postgresql://…` parses as a URL.
--
-- The length limits match the ones already on `seo_title` and `seo_description`,
-- because the values fall back to each other and a limit that applies to one
-- half of a fallback chain is not a limit.

alter table public.product_translations
  add constraint product_translations_canonical_url_absolute check (
    canonical_url is null or canonical_url ~ '^https?://'
  ),
  add constraint product_translations_og_title_length check (
    og_title is null or char_length(og_title) <= 120
  ),
  add constraint product_translations_og_description_length check (
    og_description is null or char_length(og_description) <= 320
  );

alter table public.category_translations
  add constraint category_translations_canonical_url_absolute check (
    canonical_url is null or canonical_url ~ '^https?://'
  ),
  add constraint category_translations_og_title_length check (
    og_title is null or char_length(og_title) <= 120
  ),
  add constraint category_translations_og_description_length check (
    og_description is null or char_length(og_description) <= 320
  );

alter table public.brand_translations
  add constraint brand_translations_canonical_url_absolute check (
    canonical_url is null or canonical_url ~ '^https?://'
  ),
  add constraint brand_translations_og_title_length check (
    og_title is null or char_length(og_title) <= 120
  ),
  add constraint brand_translations_og_description_length check (
    og_description is null or char_length(og_description) <= 320
  );

alter table public.content_page_translations
  add constraint content_page_translations_canonical_url_absolute check (
    canonical_url is null or canonical_url ~ '^https?://'
  ),
  add constraint content_page_translations_og_title_length check (
    og_title is null or char_length(og_title) <= 120
  ),
  add constraint content_page_translations_og_description_length check (
    og_description is null or char_length(og_description) <= 320
  );

-- -----------------------------------------------------------------------------
-- Documentation
-- -----------------------------------------------------------------------------
-- `og_image_path` is a storage object path inside an existing bucket, never a
-- URL — the same convention `products.logo_path` and `brands.logo_path` use.
-- Storing a URL would hard-code the project reference into every row and break
-- on a restore into a different project.

comment on column public.product_translations.canonical_url is
  'Absolute canonical URL for this locale. Null means the storefront emits its own self-referential canonical.';
comment on column public.product_translations.og_image_path is
  'Storage object path in the products bucket, not a URL. Falls back to the first product image.';
comment on column public.category_translations.og_image_path is
  'Storage object path in the site-assets bucket, not a URL.';
comment on column public.brand_translations.og_image_path is
  'Storage object path in the brands bucket, not a URL. Falls back to the brand logo.';
comment on column public.content_page_translations.og_image_path is
  'Storage object path in the site-assets bucket, not a URL.';
