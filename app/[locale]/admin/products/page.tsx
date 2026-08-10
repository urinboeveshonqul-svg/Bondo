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
import { requireAdmin } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as productsService from "@/services/products.service";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Products" };

/**
 * How many products the list loads.
 *
 * `ModuleTable` paginates in memory, so this is the working set rather than the
 * page size — one query, then the table's own search and filters run over it
 * without a round trip. It stops being the right shape somewhere in the low
 * thousands, which is **D-2**; the service already takes `page`, so moving the
 * pagination into the query is a prop change rather than a rewrite.
 */
const ADMIN_PAGE_SIZE = 100;

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
  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("products", permissions);

  const t = await getTranslations("adminCatalog.products");
  const activeLocale = (await getLocale()) as Locale;

  // Every product, drafts and archives included — this is the screen that
  // manages them, and an operator cannot republish something the list hides.
  // RLS allows it because `products.read` sees all; an anonymous visitor
  // reading the same table gets only published rows.
  const supabase = await createClient();
  const [listed, categories, brands] = await Promise.all([
    productsService.listProducts(supabase, {
      pageSize: ADMIN_PAGE_SIZE,
      sort: "updated_at",
      direction: "desc",
    }),
    categoriesService.listCategories(supabase),
    brandsService.listBrands(supabase),
  ]);

  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name[activeLocale]]),
  );

  const rows = listed.rows.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    brandName: product.brand?.name ?? "",
    brandId: product.brand?.id ?? null,
    categoryId: product.categoryId,
    categoryName: categoryNames.get(product.categoryId ?? "") ?? "",
    priceCents: product.priceCents,
    salePriceCents: product.salePriceCents,
    status: product.status,
    visibility: product.visibility,
    isFeatured: product.isFeatured,
    isTranslationComplete: product.isTranslationComplete,
    updatedAt: product.updatedAt,
    // The list query does not select `deleted_at` and does not need to: it
    // filters soft-deleted rows out, so anything here is live.
    deletedAt: null,
    shortDescription: product.shortDescription,
    // Not in `LIST_COLUMNS`. A row-level publish resends it as empty, which
    // `optionalLocalizedText` accepts and `toTranslationRows` skips — so an
    // untouched description is left alone rather than blanked.
    description: { uz: "", ru: "", en: "" },
    warrantyMonths: null,
  }));

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle", { count: listed.total })}
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
        products={rows}
        categoryOptions={categories.map((category) => ({
          value: category.id,
          label: `${"— ".repeat(category.depth)}${category.name[activeLocale]}`,
        }))}
        brandOptions={brands.map((brand) => ({
          value: brand.id,
          label: brand.name,
        }))}
        capabilities={capabilities}
      />
    </>
  );
}
