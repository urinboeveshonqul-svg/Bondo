import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { ProductForm } from "@/components/admin/modules/products/product-form";
import { ModuleHeader } from "@/components/admin/module/module-header";
import { guardModule } from "@/components/admin/module/module-permission-guard";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { toProductDraft } from "@/lib/admin/product-draft";
import { pick } from "@/lib/i18n/translations";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { isAppError } from "@/lib/errors";
import { createClient } from "@/supabase/server";
import * as brandsService from "@/services/brands.service";
import * as categoriesService from "@/services/categories.service";
import * as productsService from "@/services/products.service";
import type { PageParams } from "@/types";
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

  const t = await getTranslations("adminCatalog");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;

  const supabase = await createClient();

  // `includeDeleted`, so a soft-deleted product opens and can be restored. A
  // read that hid it would make the undo unreachable from the only screen that
  // offers one.
  const detail = await productsService
    .getProductById(supabase, id, { includeDeleted: true })
    .catch((error: unknown) => {
      // A missing row is a 404; anything else is a real failure and should not
      // be disguised as one.
      if (isAppError(error) && error.code === "not_found") notFound();
      throw error;
    });

  const [categories, brands] = await Promise.all([
    categoriesService.listCategories(supabase),
    brandsService.listBrands(supabase),
  ]);

  const draft = toProductDraft(supabase, detail);
  const title = pick(draft.name, activeLocale) || draft.sku;
  const storefrontSlug = pick(draft.slug, activeLocale);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[
          { label: t("products.title"), href: routes.admin.products },
          { label: title },
        ]}
        title={title}
        description={formatDate(draft.updatedAt ?? "", activeLocale)}
        actions={
          <>
            <ModuleStatusBadge
              tone={
                draft.deletedAt
                  ? "warning"
                  : draft.status === "active" && draft.visibility === "public"
                    ? "success"
                    : "muted"
              }
            >
              {tAdmin(`status.${draft.deletedAt ? "archived" : draft.status}`)}
            </ModuleStatusBadge>

            {/* Only offered when the storefront would actually serve it — a
                "view" button on a draft leads to a 404. */}
            {storefrontSlug &&
            draft.status === "active" &&
            draft.visibility === "public" &&
            !draft.deletedAt ? (
              <Button asChild variant="outline">
                <Link href={routes.catalog.detail(storefrontSlug)}>
                  {tAdmin("actions.view")}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <ProductForm
        product={draft}
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
