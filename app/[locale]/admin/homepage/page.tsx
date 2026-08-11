import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { HomepageManager } from "@/components/admin/modules/homepage/homepage-manager";
import { locales } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as settingsService from "@/services/settings.service";
import type { PageParams } from "@/types";
import type { EditableBanner } from "@/types/admin";

export const metadata: Metadata = { title: "Homepage" };

export default async function AdminHomepagePage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("homepage", permissions);

  const t = await getTranslations("adminHomepage");

  const supabase = await createClient();
  const rows = await settingsService.listBannersForAdmin(supabase);

  // Every locale gets a string: the editor renders controlled inputs, and a
  // banner saved before a language existed has no row for it.
  const text = (
    banner: (typeof rows)[number],
    field: "title" | "subtitle" | "ctaLabel",
  ) =>
    Object.fromEntries(
      locales.map((each) => [each, banner.translations[each]?.[field] ?? ""]),
    ) as EditableBanner["title"];

  const banners: EditableBanner[] = rows.map((banner) => ({
    id: banner.id,
    placement: banner.placement,
    linkUrl: banner.link_url ?? "",
    displayOrder: banner.display_order,
    isActive: banner.is_active,
    startsAt: banner.starts_at,
    endsAt: banner.ends_at,
    title: text(banner, "title"),
    subtitle: text(banner, "subtitle"),
    ctaLabel: text(banner, "ctaLabel"),
  }));

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="homepage" permissions={permissions} />

      <HomepageManager banners={banners} capabilities={capabilities} />
    </>
  );
}
