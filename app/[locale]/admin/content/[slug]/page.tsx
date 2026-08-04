import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { PageForm } from "@/components/admin/modules/content/page-form";
import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { getAdminSession, getContentPage } from "@/mocks/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Edit page" };

export default async function AdminContentEditorPage({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { permissions } = getAdminSession();
  const capabilities = await guardModule("content", permissions);

  const page = getContentPage(slug);
  if (!page) notFound();

  const t = await getTranslations("adminContent.pages");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[
          { label: t("title"), href: routes.admin.content },
          { label: page.title[activeLocale] },
        ]}
        title={page.title[activeLocale]}
        description={`/${page.slug}`}
      />

      <ModuleReadOnlyNotice id="content" permissions={permissions} />

      <PageForm page={page} capabilities={capabilities} />
    </>
  );
}
