import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { SettingsForm } from "@/components/admin/modules/settings/settings-form";
import { getAdminSession, storeSettings } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  const capabilities = await guardModule("settings", permissions);

  const t = await getTranslations("adminSystem.settings");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="settings" permissions={permissions} />

      <SettingsForm settings={storeSettings} capabilities={capabilities} />
    </>
  );
}
