import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CategoriesManager } from "@/components/admin/catalog/categories-manager";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { can } from "@/lib/admin/permissions";
import { getAdminSession } from "@/mocks/admin";
import { categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, ["categories.read", "categories.manage"])) notFound();

  const t = await getTranslations("adminCatalog.categories");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <CategoriesManager
        categories={categories}
        canManage={can(permissions, "categories.manage")}
      />
    </>
  );
}
