import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";

import { BrandsManager } from "@/components/admin/catalog/brands-manager";
import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/admin/permissions";
import { getAdminSession } from "@/mocks/admin";
import { brands } from "@/mocks/catalog";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Brands" };

export default async function AdminBrandsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  if (!can(permissions, ["brands.read", "brands.manage"])) notFound();

  const t = await getTranslations("adminCatalog.brands");
  const canManage = can(permissions, "brands.manage");

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />

      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            <Button disabled>
              <Plus aria-hidden="true" />
              {t("new")}
            </Button>
          ) : null
        }
      />

      <BrandsManager brands={brands} canManage={canManage} />
    </>
  );
}
