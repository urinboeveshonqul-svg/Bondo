import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { BrandsManager } from "@/components/admin/modules/brands/brands-manager";
import { createClient } from "@/supabase/server";
import * as brandsService from "@/services/brands.service";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Brands" };

export default async function AdminBrandsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("brands", permissions);

  const t = await getTranslations("adminCatalog.brands");

  // The real table, including hidden brands — this is the screen that manages
  // them, and an operator cannot unhide something the list does not show. RLS
  // allows it because `brands.read` sees all; an anonymous request to the same
  // table gets only the visible ones.
  const supabase = await createClient();
  const [rows, counts] = await Promise.all([
    brandsService.listBrands(supabase),
    brandsService.countProductsByBrand(supabase),
  ]);

  const brands = rows.map((brand) => ({
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    websiteUrl: brand.websiteUrl ?? "",
    isFeatured: brand.isFeatured,
    isVisible: brand.isVisible,
    productCount: counts.get(brand.id) ?? 0,
  }));

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
        actions={
          // Creating happens in the manager's dialog, which owns the form
          // state — so the header button is rendered there rather than here.
          null
        }
      />

      <ModuleReadOnlyNotice id="brands" permissions={permissions} />

      <BrandsManager brands={brands} capabilities={capabilities} />
    </>
  );
}
