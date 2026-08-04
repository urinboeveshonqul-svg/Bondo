import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Pencil } from "lucide-react";

import { AdminBreadcrumbs } from "@/components/admin/layout/admin-breadcrumbs";
import { PageHeader } from "@/components/admin/shared/page-header";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { can } from "@/lib/admin/permissions";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { contentPages, getAdminSession } from "@/mocks/admin";
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

  const { permissions } = getAdminSession();
  if (!can(permissions, ["banners.read", "banners.manage"])) notFound();

  const t = await getTranslations("adminContent.pages");
  const tAdmin = await getTranslations("admin");
  const activeLocale = (await getLocale()) as Locale;

  return (
    <>
      <AdminBreadcrumbs items={[{ label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />

      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {t("notLinkedYet")}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {contentPages.map((page) => (
          <li
            key={page.slug}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <h2 className="truncate font-medium">
                  {page.title[activeLocale]}
                </h2>
                <p className="font-mono text-xs text-muted-foreground">
                  /{page.slug}
                </p>
              </div>
              <StatusBadge tone={page.isPublished ? "success" : "neutral"}>
                {page.isPublished ? t("published") : t("draft")}
              </StatusBadge>
            </div>

            <p className="line-clamp-2 flex-1 text-sm text-pretty text-muted-foreground">
              {page.excerpt[activeLocale]}
            </p>

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <p className="truncate text-xs text-muted-foreground">
                {tAdmin("updatedBy", { name: page.updatedBy })} ·{" "}
                {formatDate(page.updatedAt, activeLocale)}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link href={routes.admin.contentPage(page.slug)}>
                  <Pencil aria-hidden="true" />
                  {tAdmin("actions.edit")}
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
