import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProductForm } from "@/components/admin/catalog/product-form";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { getAdminProduct, getAdminSession } from "@/mocks/admin";
import { brands, categories } from "@/mocks/catalog";
import type { PageParams } from "@/types";
import { publishState } from "@/utils/admin";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: PageParams<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, "products.read")) notFound();

  const product = getAdminProduct(id);
  if (!product) notFound();

  const t = await getTranslations("adminCatalog");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;
  const state = publishState(product);

  return (
    <>
      <AdminBreadcrumbs
        items={[
          { label: t("products.title"), href: routes.admin.products },
          { label: product.name[activeLocale] },
        ]}
      />

      <PageHeader
        title={product.name[activeLocale]}
        description={`${tAdmin("updatedBy", { name: product.updatedBy })} · ${formatDate(
          product.updatedAt,
          activeLocale,
        )}`}
        actions={
          <>
            <StatusBadge
              tone={
                state === "published"
                  ? "success"
                  : state === "scheduled"
                    ? "info"
                    : state === "hidden"
                      ? "muted"
                      : "neutral"
              }
            >
              {tAdmin(`status.${state}`)}
            </StatusBadge>
            <Button asChild variant="outline">
              <Link href={routes.catalog.detail(product.slug)}>
                {tAdmin("actions.view")}
              </Link>
            </Button>
          </>
        }
      />

      <ProductForm
        product={product}
        canEdit={can(permissions, "products.update")}
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
