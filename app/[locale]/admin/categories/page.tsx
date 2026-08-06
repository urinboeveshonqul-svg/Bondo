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
import * as storageService from "@/services/storage.service";
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
  //
  // Two queries for the whole tree, translations included: `listCategories`
  // embeds `category_translations`, and the counts are one more read tallied in
  // memory. No query per category and none per level.
  const supabase = await createClient();
  const [rows, directCounts] = await Promise.all([
    categoriesService.listCategories(supabase),
    categoriesService.countProductsByCategory(supabase),
  ]);

  // A department shows the products in its whole subtree, because that is the
  // number an operator means by "how much is in Components".
  const counts = categoriesService.rollUpProductCounts(rows, directCounts);

  const categories = rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    displayOrder: row.displayOrder,
    isVisible: row.isVisible,
    isFeatured: row.isFeatured,
    icon: row.icon,
    imagePath: row.imagePath,
    // Resolved here rather than in the client component: `publicUrl` needs a
    // Supabase client, and a form field should not be constructing one.
    imageUrl: row.imagePath
      ? storageService.publicUrl(supabase, "site-assets", row.imagePath)
      : "",
    name: row.name,
    slug: row.slug,
    description: row.description,
    seo: {
      // The category's own slug is edited in the General section, so the SEO
      // panel does not repeat it. `null` is what tells the panel to omit it.
      slug: null,
      metaTitle: row.seoTitle,
      metaDescription: row.seoDescription,
      keywords: row.seoKeywords,
      canonicalUrl: row.canonicalUrl,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImagePath: row.ogImagePath,
      twitterCard: row.twitterCard,
    },
    isTranslationComplete: row.isTranslationComplete,
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
