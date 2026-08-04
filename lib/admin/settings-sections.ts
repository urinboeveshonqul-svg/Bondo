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
 * ## Why these six and not the eight a store eventually needs
 *
 * `shipping` and `taxes` are **not** here, and the omission is deliberate rather
 * than an oversight. Tax rate and delivery thresholds are already fields inside
 * `commerce`, backed by real `settings` rows; a Shipping section in the sense a
 * store needs — zones, rates, carriers — needs tables that do not exist and
 * arrive with Phase 8. Declaring the tab now would put an empty screen behind a
 * real-looking label, which is the shape of problem ADR-20 exists to prevent.
 *
 * The same reasoning keeps `appearance` and `localization` out: the theme is a
 * per-visitor choice held in `next-themes`, and the locale list is an enum in
 * the database (adding one is a migration, not a setting). Both would be
 * controls that look like settings and change nothing.
 *
 * Pure data, no React — `lib/` may be imported from anywhere (§ 4).
 */

import type { Permission } from "@/lib/admin/permissions";

export const SETTINGS_SECTIONS = [
  {
    id: "store",
    /** Key into `adminSystem.settings.tabs`. */
    labelKey: "store",
    /** The `settings` key prefix this section owns, for the eventual service. */
    prefix: "store",
    permission: "settings.read",
  },
  {
    id: "commerce",
    labelKey: "commerce",
    prefix: "commerce",
    permission: "settings.read",
  },
  {
    id: "email",
    labelKey: "email",
    prefix: "email",
    permission: "settings.read",
  },
  {
    id: "social",
    labelKey: "social",
    prefix: "social",
    permission: "settings.read",
  },
  {
    id: "branding",
    labelKey: "branding",
    prefix: "branding",
    permission: "settings.read",
  },
  {
    id: "hours",
    labelKey: "hours",
    prefix: "hours",
    permission: "settings.read",
  },
] as const satisfies readonly {
  id: string;
  labelKey: string;
  prefix: string;
  permission: Permission;
}[];

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
