import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

import { PageForm } from "@/components/admin/modules/content/page-form";
import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { requireAdmin } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as contentService from "@/services/content-pages.service";
import type { EditableContentPage } from "@/types/admin";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Edit page" };

export default async function AdminContentEditorPage({
  params,
}: {
  params: PageParams<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("content", permissions);

  // The route segment is the page `key`, and drafts must open — an editor
  // reaching for an unpublished page is the whole point of this screen, so the
  // published-only storefront reader is the wrong function here.
  const supabase = await createClient();
  const pages = await contentService.listAllContentPages(supabase);
  const found = pages.find((candidate) => candidate.key === slug);
  if (!found) notFound();

  // `LocalizedField` renders controlled inputs, so every locale needs a string
  // rather than the nulls the columns allow.
  const text = (value: Record<string, string | null>) =>
    Object.fromEntries(
      locales.map((locale) => [locale, value[locale] ?? ""]),
    ) as EditableContentPage["title"];

  const page: EditableContentPage = {
    id: found.id,
    key: found.key,
    isPublished: found.isPublished,
    displayOrder: found.displayOrder,
    title: text(found.title),
    excerpt: text(found.excerpt),
    body: text(found.body),
    seoTitle: text(found.seoTitle),
    seoDescription: text(found.seoDescription),
  };

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
        description={`/${page.key}`}
      />

      <ModuleReadOnlyNotice id="content" permissions={permissions} />

      <PageForm page={page} capabilities={capabilities} />
    </>
  );
}
