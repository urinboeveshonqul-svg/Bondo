import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ModuleHeader } from "@/components/admin/module/module-header";
import {
  ModuleReadOnlyNotice,
  guardModule,
} from "@/components/admin/module/module-permission-guard";
import { HighlightsManager } from "@/components/admin/modules/highlights/highlights-manager";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/supabase/server";
import * as highlightsService from "@/services/service-highlights.service";
import type { PageParams } from "@/types";

export const metadata: Metadata = { title: "Service highlights" };

/**
 * Service highlights.
 *
 * Reads **every** highlight, hidden ones included — this is the screen that
 * manages them, and an operator cannot unhide something the list does not show.
 * RLS allows it because `banners.read` sees all; an anonymous request to the
 * same table gets only the visible rows.
 */
export default async function AdminHighlightsPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { authorization } = await requireAdmin();
  const { permissions } = authorization;
  const capabilities = await guardModule("highlights", permissions);

  const t = await getTranslations("adminHighlights");
  const supabase = await createClient();
  const highlights = await highlightsService.listHighlights(supabase);

  return (
    <>
      <ModuleHeader
        breadcrumbs={[{ label: t("title") }]}
        title={t("title")}
        description={t("subtitle")}
      />

      <ModuleReadOnlyNotice id="highlights" permissions={permissions} />

      <HighlightsManager highlights={highlights} capabilities={capabilities} />
    </>
  );
}
