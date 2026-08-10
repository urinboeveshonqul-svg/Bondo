-- =============================================================================
-- "Butlovchi qismlar" → "Kompyuter qismlari"
-- =============================================================================
-- A wording change to two Uzbek category names, and nothing else.
--
-- CLAUDE.md § 11a bans `komplektuvchilar` for computer components and gives
-- `butlovchi qismlar` as the replacement. Neither the ban nor its reasoning
-- changes here: `komplektuvchilar` is still wrong. What changed is the preferred
-- replacement — the business asked for **`kompyuter qismlari`**, which is the
-- phrase a shopper types into a search box and the one Uzbek retailers put on a
-- department. `butlovchi qismlar` is correct Uzbek and slightly formal; this is
-- the shop's own vocabulary decision, not a correction.
--
-- -----------------------------------------------------------------------------
-- Uzbek only
-- -----------------------------------------------------------------------------
-- Russian keeps «Комплектующие» and English keeps "PC components": both are what
-- their own shoppers say, and the ban is on an Uzbek word, not on the concept.
-- Rewriting them to match would be exactly the parallel-translation failure
-- § 11a exists to prevent.
--
-- -----------------------------------------------------------------------------
-- Slugs are not touched
-- -----------------------------------------------------------------------------
-- `butlovchi-qismlar` stays the Uzbek URL. A slug is an address, and renaming a
-- department is not a reason to break every link that already points at it
-- (ADR-3). The two disagreeing is invisible to a shopper and reversible from the
-- admin; a dead URL is neither.
--
-- -----------------------------------------------------------------------------
-- Guarded, so an operator's own name survives
-- -----------------------------------------------------------------------------
-- The update fires only where the name is still **exactly** the string
-- `20260815001000_category_taxonomy.sql` inserted. ADR-72 promises that a
-- category somebody renamed keeps their name, and a migration that overwrote it
-- would break that promise the first time it ran.
-- =============================================================================

update public.category_translations
set name = 'Kompyuter qismlari'
where locale = 'uz'
  and slug = 'butlovchi-qismlar'
  and name = 'Butlovchi qismlar';

update public.category_translations
set name = 'Boshqa kompyuter qismlari'
where locale = 'uz'
  and slug = 'boshqa-butlovchi-qismlar'
  and name = 'Boshqa butlovchi qismlar';
