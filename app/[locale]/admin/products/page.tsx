import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { ProductsTable } from "@/components/admin/modules/products/products-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
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

  // Defence in depth. The sidebar already hides this route from anyone without
  // the permission, but a URL typed directly must not render the list — hiding
  // navigation is a usability measure, not an access control.
  const { permissions } = getAdminSession();
  const capabilities = await guardModule("products", permissions);

  const t = await getTranslations("adminCatalog.products");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle", { count: adminProducts.length })}
        actions={
          capabilities.create ? (
            <Button asChild>
              <Link href={routes.admin.productNew}>
                <Plus aria-hidden="true" />
                {t("new")}
              </Link>
            </Button>
          ) : null
        }
      />

      <ModuleReadOnlyNotice id="products" permissions={permissions} />

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
        capabilities={capabilities}
      />
    </>
  );
}
