import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { SettingsForm } from "@/components/admin/modules/settings/settings-form";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as settingsService from "@/services/settings.service";
import type { PageParams } from "@/types";
import type { EditableSettings } from "@/types/admin";

export const metadata: Metadata = { title: "Settings" };

/**
 * The form's shape from the table's rows.
 *
 * Every field is given a value even when the key has no row yet — a controlled
 * input with `undefined` becomes uncontrolled on the first keystroke, and React
 * then warns and loses the cursor position. The empty string is the honest
 * default: the migration inserts these keys with a JSON `null`, meaning "nobody
 * has configured this".
 */
function toEditable(
  settings: settingsService.ManagedSetting[],
): EditableSettings {
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  const text = (key: string): string => {
    const value = byKey.get(key)?.value;
    return typeof value === "string" ? value : "";
  };

  const number = (key: string, fallback: number): number => {
    const value = byKey.get(key)?.value;
    return typeof value === "number" ? value : fallback;
  };

  const localized = (key: string) => {
    const translations = byKey.get(key)?.translations ?? {};
    return Object.fromEntries(
      locales.map((locale) => [locale, translations[locale] ?? ""]),
    ) as EditableSettings["localized"][keyof EditableSettings["localized"]];
  };

  return {
    plain: {
      "store.name": text("store.name"),
      "store.support_email": text("store.support_email"),
      "store.phone": text("store.phone"),
      "store.telegram": text("store.telegram"),
      "orders.low_stock_email": text("orders.low_stock_email"),
    },
    numeric: {
      // The fallbacks are the migration's own seeded values, so a row that has
      // somehow been deleted renders what the schema intended rather than zero.
      "catalog.products_per_page": number("catalog.products_per_page", 24),
      "catalog.max_products_per_page": number(
        "catalog.max_products_per_page",
        96,
      ),
    },
    localized: {
      "store.address": localized("store.address"),
      "store.hours": localized("store.hours"),
    },
  };
}

export default async function AdminSettingsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("settings", permissions);

  const t = await getTranslations("adminSystem.settings");

  // Read with the operator's own session, so RLS decides what comes back — a
  // reader without `settings.read` gets an empty list rather than a filtered one
  // this page had to remember to filter (ADR-4).
  const supabase = await createClient();
  const settings = await settingsService.listManagedSettings(supabase);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="settings" permissions={permissions} />

      <SettingsForm
        settings={toEditable(settings)}
        capabilities={capabilities}
      />
    </>
  );
}
