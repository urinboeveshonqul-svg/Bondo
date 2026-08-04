import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { SettingsForm } from "@/components/admin/system/settings-form";
import { can } from "@/lib/admin/permissions";
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
  if (!can(permissions, ["settings.read", "settings.update"])) notFound();

  const t = await getTranslations("adminSystem.settings");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <SettingsForm
        settings={storeSettings}
        canUpdate={can(permissions, "settings.update")}
      />
    </>
  );
}
