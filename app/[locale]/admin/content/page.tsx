import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Pencil } from "lucide-react";

import { ModuleCard } from "@/components/admin/module/module-card";
import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { contentPages } from "@/mocks/admin";
import type { PageParams } from "@/types";
import { formatDate } from "@/utils/format";

export const metadata: Metadata = { title: "Pages" };

export default async function AdminContentPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  await guardModule("content", permissions);

  const t = await getTranslations("adminContent.pages");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="content" permissions={permissions} />

      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("notLinkedYet")}
      </p>

      {/* Cards rather than a table: eight pages with a title, a path and a
          state are not rows, and `ModuleCard` keeps them on the same grid as
          every other module rather than making this the screen that looks
          different. */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {contentPages.map((page) => (
          <li key={page.slug}>
            <ModuleCard
              className="h-full"
              title={page.title[activeLocale]}
              subtitle={`/${page.slug}`}
              badge={
                <ModuleStatusBadge
                  tone={page.isPublished ? "success" : "neutral"}
                >
                  {page.isPublished ? t("published") : t("draft")}
                </ModuleStatusBadge>
              }
              footer={`${tAdmin("updatedBy", { name: page.updatedBy })} · ${formatDate(page.updatedAt, activeLocale)}`}
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href={routes.admin.contentPage(page.slug)}>
                    <Pencil aria-hidden="true" />
                    {tAdmin("actions.edit")}
                  </Link>
                </Button>
              }
            >
              <p className="line-clamp-2 text-pretty text-muted-foreground">
                {page.excerpt[activeLocale]}
              </p>
            </ModuleCard>
          </li>
        ))}
      </ul>
    </>
  );
}
