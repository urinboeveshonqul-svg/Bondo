import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { CategoriesManager } from "@/components/admin/modules/categories/categories-manager";
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
  const capabilities = await guardModule("categories", permissions);

  const t = await getTranslations("adminCatalog.categories");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="categories" permissions={permissions} />

      <CategoriesManager categories={categories} capabilities={capabilities} />
    </>
  );
}
