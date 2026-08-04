import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HomepageManager } from "@/components/admin/content/homepage-manager";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { can } from "@/lib/admin/permissions";
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
  if (!can(permissions, ["banners.read", "banners.manage"])) notFound();

  const t = await getTranslations("adminContent.homepage");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <HomepageManager
        sections={homepageSections}
        banners={banners}
        canManage={can(permissions, "banners.manage")}
      />
    </>
  );
}
