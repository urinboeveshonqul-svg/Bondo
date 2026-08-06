import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { CategoriesManager } from "@/components/admin/modules/categories/categories-manager";
import { createClient } from "@/supabase/server";
import * as categoriesService from "@/services/categories.service";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Categories" };

export default async function AdminCategoriesPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("categories", permissions);

  const t = await getTranslations("adminCatalog.categories");

  // Every category, hidden ones included — this is the screen that manages them
  // and an operator cannot unhide something the list does not show. RLS allows
  // it because `categories.read` sees all.
  const supabase = await createClient();
  const [rows, counts] = await Promise.all([
    categoriesService.listCategories(supabase),
    categoriesService.countProductsByCategory(supabase),
  ]);

  const categories = rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    name: row.name,
    slug: row.slug,
    description: row.description,
    productCount: counts.get(row.id) ?? 0,
  }));

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
