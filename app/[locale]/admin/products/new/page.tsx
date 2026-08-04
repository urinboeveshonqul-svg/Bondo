import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProductForm } from "@/components/admin/catalog/product-form";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { can } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { getAdminSession } from "@/mocks/admin";
import { brands, categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, "products.create")) notFound();

  const t = await getTranslations("adminCatalog");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <AdminBreadcrumbs
        items={[
          { label: t("products.title"), href: routes.admin.products },
          { label: t("editor.newTitle") },
        ]}
      />

      <PageHeader title={t("editor.newTitle")} />

      <ProductForm
        product={null}
        canEdit
        categoryOptions={categories.map((category) => ({
          value: category.slug,
          label: category.name[activeLocale],
        }))}
        brandOptions={brands.map((brand) => ({
          value: brand.name,
          label: brand.name,
        }))}
      />
    </>
  );
}
