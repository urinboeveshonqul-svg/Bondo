import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { ProductForm } from "@/components/admin/modules/products/product-form";
import { requireAdmin } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
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

  // `create`, not the module's view permission: reaching the products list is
  // not the same as being allowed to add to it.
  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("products", permissions, "create");

  const t = await getTranslations("adminCatalog");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[
          { label: t("products.title"), href: routes.admin.products },
          { label: t("editor.newTitle") },
        ]}
        title={t("editor.newTitle")}
      />

      <ProductForm
        product={null}
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
