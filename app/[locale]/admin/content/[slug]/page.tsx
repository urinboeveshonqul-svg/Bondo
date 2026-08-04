import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { PageForm } from "@/components/admin/content/page-form";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { can } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { getAdminSession, getContentPage } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Edit page" };

export default async function AdminContentEditorPage({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, ["banners.read", "banners.manage"])) notFound();

  const page = getContentPage(slug);
  if (!page) notFound();

  const t = await getTranslations("adminContent.pages");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <AdminBreadcrumbs
        items={[
          { label: t("title"), href: routes.admin.content },
          { label: page.title[activeLocale] },
        ]}
      />

      <PageHeader
        title={page.title[activeLocale]}
        description={`/${page.slug}`}
      />

      <PageForm page={page} canManage={can(permissions, "banners.manage")} />
    </>
  );
}
