# How localization works in the admin

Two different things are translated, by two different people, on two different
schedules. Keeping them apart is **ADR-39**.

| What                                  | Lives in                     | Written by     | Changes with |
| ------------------------------------- | ---------------------------- | -------------- | ------------ |
| Interface chrome — "Save", "Products" | `messages/{uz,ru,en}/*.json` | a developer    | a deploy     |
| Catalog copy — a product name, a page | `*_translations` rows        | a merchandiser | an edit      |

A product description in a message file would build the wrong pattern and then
need unpicking. A button label on a row would be written three thousand times.

---

## Chrome

One namespace per feature area, three files each, enforced by
`scripts/check-translations.mjs` as part of `npm run check`. It fails on a
missing namespace, a key missing in either direction, an empty value, or an ICU
placeholder renamed in one language.

```
messages/en/admin.json          shared admin chrome — table, form, seo, media, history
messages/en/adminCatalog.json   products, categories, brands
messages/en/adminContent.json   homepage, pages
messages/en/adminSystem.json    team, roles, settings, audit
messages/en/adminInventory.json inventory
messages/en/adminDashboard.json the dashboard
```

Read them with `useTranslations("namespace")`. It works in Server **and** Client
Components, so a table of sixty rows still ships no JavaScript for its labels.

ICU for anything with a count — Russian needs `few` and `many`, which a ternary
cannot express:

```json
"selected": "{count, plural, one {Выбрана # строка} few {Выбрано # строки} many {Выбрано # строк} other {Выбрано # строки}}"
```

## Record content

Every translatable field is a `LocalizedText` — `Record<Locale, string>`,
**required** in all three, so TypeScript rejects a record written in one
language. In the database it is a row per `(entity, locale)` in a
`*_translations` table (ADR-51), and the fold between the two shapes happens in
`lib/i18n/translations.ts`, used by every service and every form. A page or a
component never sees a `*_translations` row.

### The field

```tsx
<LocalizedField
  label={t("fields.name")}
  value={draft.name}
  onChange={(name) => set("name", name)}
  required
/>
```

Tabs rather than three stacked inputs: a form with eight translatable fields
becomes twenty-four inputs otherwise, and nobody scrolls past the first
language. The tab strip is a real `tablist` — arrow keys move between languages,
`aria-selected` tracks the active one, and only the active tab is in the tab
order. Rolling that by hand with buttons and `hidden` is how a language becomes
unreachable by keyboard.

`ModuleLanguageTabs` is the strip on its own, for a control that needs to build
its own body.

### Which fields are _not_ localized, and why

| Field             | Reason                                              |
| ----------------- | --------------------------------------------------- |
| SKU               | An identifier                                       |
| Search keywords   | Search terms; a shopper types "rtx" in any language |
| Brand slug        | A trademark, spelled the same in all three          |
| Twitter card type | A layout choice, not copy — see below               |

Everything a crawler reads **is** localized: slug, meta title, meta description,
canonical and the Open Graph copy, all columns on the translation row since
`20260805001000_social_metadata.sql`. The storefront emits an `hreflang` set per
page (ADR-40); pointing three languages at one English description defeats the
purpose of having them.

The share image and card type are single values written to every locale. A large
card in English and a small one in Russian is an inconsistency, not a
translation. The columns stay per-locale so the distinction is there the day a
store needs it.

## Completeness and publishing

`coverageOf()` in `lib/i18n/translations.ts` is the single source for "is this
record translated". It is what:

- `TranslationStatus` shows beside a field
- `TranslationProgress` shows in the form's localization section and aside
- `MissingTranslationIndicator` shows as dots in a list
- `isPublishable()` refuses a publish with (**ADR-53**)

One function, so a form that says "complete" and a save that refuses can never
disagree. Putting the rule in the service rather than the form means it also
holds for an import script.

## Adding a language

Add it to `locales` and `localeConfig` in `lib/site-config.ts`, create
`messages/<code>/` with every namespace, and add the script to the font subsets
in `app/[locale]/layout.tsx`. Nothing else hardcodes the list.

In the database it is a new value on the `locale` enum, which means a migration —
correct, because adding a language is never only a data change (it needs message
files, a font subset and a routing entry). `Locale` derives from `Enums<"locale">`,
so the two cannot drift.

## The rules, restated

- No user-facing string is hardcoded in a component
- Every feature ships all three languages; `npm run check` fails otherwise
- Dates, numbers and prices go through `Intl` with the locale's BCP 47 tag
- `Link` comes from `@/i18n/navigation`, never `next/link` — ESLint enforces it
- Never machine-translate. A wrong register reads as carelessness in the
  reader's own language
