import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { BrandsManager } from "@/components/admin/modules/brands/brands-manager";
import { Button } from "@/components/ui/button";
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
  const capabilities = await guardModule("brands", permissions);

  const t = await getTranslations("adminCatalog.brands");

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
        actions={
          capabilities.create ? (
            <Button disabled>
              <Plus aria-hidden="true" />
              {t("new")}
            </Button>
          ) : null
        }
      />

      <ModuleReadOnlyNotice id="brands" permissions={permissions} />

      <BrandsManager brands={brands} capabilities={capabilities} />
    </>
  );
}
