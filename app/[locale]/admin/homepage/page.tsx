import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { HomepageManager } from "@/components/admin/modules/homepage/homepage-manager";
import { banners, getAdminSession, homepageSections } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Homepage" };

export default async function AdminHomepagePage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  const capabilities = await guardModule("homepage", permissions);

  const t = await getTranslations("adminContent.homepage");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="homepage" permissions={permissions} />

      <HomepageManager
        sections={homepageSections}
        banners={banners}
        capabilities={capabilities}
      />
    </>
  );
}
