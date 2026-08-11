/**
 * The settings sections, as data.
 *
 * Settings are the module most likely to grow: shipping zones, tax rules, a
 * payment provider's keys, a returns window. Each of those arrives as "one more
 * tab", and one more tab written by hand is one more chance to get the heading
 * level, the save button or the permission check subtly different from the six
 * beside it.
 *
 * So the strip is derived. A new section is an entry here plus a panel in
 * `components/admin/modules/settings/settings-form.tsx`, and it inherits the
 * tab strip, the ordering, the translated label and the permission gate.
 *
 * ## `status` is the honest part
 *
 * A section is `"live"` when it edits real `settings` rows, and `"planned"` when
 * the tab exists but the feature does not. A planned tab renders a stated
 * "not built yet" panel naming the phase that brings it — it never renders an
 * empty form, and it never renders controls that discard what you type.
 *
 * That distinction is why the planned tabs are allowed here at all. ADR-20
 * forbids placeholder *data*; a labelled, self-describing gap is the opposite —
 * it tells an operator what the store will do and what it cannot do yet, which
 * is information they otherwise have to ask a developer for.
 *
 * **Six sections were marked `live` and were not.** Commerce, email, social,
 * branding and hours rendered full forms over `settings` keys that do not
 * exist — every field discarded what was typed into it, which is the exact
 * failure `status` was introduced to make impossible. They are `planned` now,
 * and the sections that replaced them (`store`, `catalog`, `orders`) are the
 * three prefixes that have rows in the table.
 *
 * Pure data, no React — `lib/` may be imported from anywhere (§ 4).
 */

import type { Permission } from "@/lib/admin/permissions";

export const SETTINGS_SECTIONS = [
  {
    id: "store",
    /** Key into `adminSystem.settings.tabs`. */
    labelKey: "store",
    /** The `settings` key prefix this section owns. */
    prefix: "store",
    permission: "settings.read",
    status: "live",
  },
  {
    id: "catalog",
    labelKey: "catalog",
    prefix: "catalog",
    permission: "settings.read",
    status: "live",
  },
  {
    id: "orders",
    labelKey: "orders",
    prefix: "orders",
    permission: "settings.read",
    status: "live",
  },
  {
    id: "localization",
    labelKey: "localization",
    prefix: "localization",
    permission: "settings.read",
    status: "planned",
    /** What has to exist first, shown to the operator rather than hidden. */
    blockedBy: "perUserLocale",
  },
  {
    id: "appearance",
    labelKey: "appearance",
    prefix: "appearance",
    permission: "settings.read",
    status: "planned",
    blockedBy: "themeIsPerVisitor",
  },
  {
    id: "email",
    labelKey: "email",
    prefix: "email",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsMailProvider",
  },
  {
    id: "social",
    labelKey: "social",
    prefix: "social",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsSocialColumns",
  },
  {
    id: "branding",
    labelKey: "branding",
    prefix: "branding",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsBrandingAssets",
  },
  {
    id: "hours",
    labelKey: "hours",
    prefix: "hours",
    permission: "settings.read",
    status: "planned",
    blockedBy: "hoursAreOneSetting",
  },
  {
    id: "taxes",
    labelKey: "taxes",
    prefix: "taxes",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsCheckout",
  },
  {
    id: "shipping",
    labelKey: "shipping",
    prefix: "shipping",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsShippingTables",
  },
  {
    id: "payments",
    labelKey: "payments",
    prefix: "payments",
    permission: "settings.read",
    status: "planned",
    blockedBy: "needsCheckout",
  },
] as const satisfies readonly {
  id: string;
  labelKey: string;
  prefix: string;
  permission: Permission;
  status: "live" | "planned";
  blockedBy?: string;
}[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsSectionId = SettingsSection["id"];

/** The sections that actually edit something. */
export const LIVE_SETTINGS_SECTIONS = SETTINGS_SECTIONS.filter(
  (section) => section.status === "live",
);
