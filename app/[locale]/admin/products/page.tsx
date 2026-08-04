import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";

import { ProductsTable } from "@/components/admin/catalog/products-table";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { adminProducts, getAdminSession } from "@/mocks/admin";
import { brands, categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();

  // Defence in depth. The sidebar already hides this route from anyone without
  // the permission, but a URL typed directly must not render the list — hiding
  // navigation is a usability measure, not an access control.
  if (!can(permissions, "products.read")) notFound();

  const t = await getTranslations("adminCatalog.products");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />

      <PageHeader
        title={t("title")}
        description={t("subtitle", { count: adminProducts.length })}
        actions={
          can(permissions, "products.create") ? (
            <Button asChild>
              <Link href={routes.admin.productNew}>
                <Plus aria-hidden="true" />
                {t("new")}
              </Link>
            </Button>
          ) : null
        }
      />

      <ProductsTable
        products={adminProducts}
        categoryOptions={categories.map((category) => ({
          value: category.slug,
          label: category.name[activeLocale],
        }))}
        brandOptions={brands.map((brand) => ({
          value: brand.name,
          label: brand.name,
        }))}
        canUpdate={can(permissions, "products.update")}
        canDelete={can(permissions, "products.delete")}
      />
    </>
  );
}
