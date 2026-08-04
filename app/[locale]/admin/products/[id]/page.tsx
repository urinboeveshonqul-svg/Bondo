import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProductForm } from "@/components/admin/modules/products/product-form";
import { ModuleHeader } from "@/components/admin/module/module-header";
import { ModuleAuditHistory } from "@/components/admin/module/module-audit-history";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { auditEntries, getAdminProduct } from "@/mocks/admin";
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

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("products", permissions);

  const product = getAdminProduct(id);
  if (!product) notFound();

  const t = await getTranslations("adminCatalog");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;
  const state = publishState(product);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[
          { label: t("products.title"), href: routes.admin.products },
          { label: product.name[activeLocale] },
        ]}
        title={product.name[activeLocale]}
        description={`${tAdmin("updatedBy", { name: product.updatedBy })} · ${formatDate(
          product.updatedAt,
          activeLocale,
        )}`}
        actions={
          <>
            <ModuleStatusBadge
              tone={
                state === "active"
                  ? "success"
                  : state === "scheduled"
                    ? "info"
                    : state === "hidden" || state === "archived"
                      ? "muted"
                      : "neutral"
              }
            >
              {tAdmin(`status.${state}`)}
            </ModuleStatusBadge>
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

      {/* Declared `audit: true` in the registry, so the module shows its trail.
          Filtered to this entity type rather than this row, because the mock log
          predates the products it describes — with a service it is one
          `entity_id` filter. */}
      <ModuleAuditHistory
        entries={auditEntries.filter((entry) => entry.entityType === "product")}
        limit={5}
      />
    </>
  );
}
