"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { SortableList } from "@/components/admin/module/module-sortable-list";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { Locale } from "@/lib/site-config";
import type { Banner, HomepageSection } from "@/types/admin";
import { formatDate } from "@/utils/format";

/**
 * Homepage composition.
 *
 * The storefront home page renders ten fixed bands today. This screen is the
 * shape that replaces them: an ordered, toggleable list whose `position` and
 * `isVisible` drive what the page renders and in what order. The section *types*
 * stay a closed set — each one maps to a component that already exists, and an
 * arbitrary "add any block" builder is a different product.
 *
 * Banners are separate because they are scheduled content with their own
 * lifecycle: a banner can go live on a date without anyone touching the page
 * order.
 */
export function HomepageManager({
  sections,
  banners,
  capabilities,
}: {
  sections: readonly HomepageSection[];
  banners: readonly Banner[];
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule.
  const canManage = capabilities.update;
  const t = useTranslations("adminContent.homepage");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [rows, setRows] = useState<HomepageSection[]>(() =>
    [...sections].sort((a, b) => a.position - b.position),
  );

  function notSaved() {
    toast(tAdmin("notSaved.title"), { description: tAdmin("notSaved.body") });
  }

  return (
    <Tabs defaultValue="sections">
      <TabsList>
        <TabsTrigger value="sections">{t("sectionLabel")}</TabsTrigger>
        <TabsTrigger value="banners">{t("banners.title")}</TabsTrigger>
      </TabsList>

      <TabsContent value="sections" className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">{t("reorderHint")}</p>

        <SortableList
          items={rows.map((row) => ({ ...row, label: row.title[locale] }))}
          disabled={!canManage}
          onReorder={(next) =>
            // Position is rewritten from array order on every reorder, so the
            // stored integer and the visible order cannot drift apart.
            setRows(next.map((row, index) => ({ ...row, position: index })))
          }
          renderItem={(row, index) => (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {row.title[locale]}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t(`types.${row.type}`)}
                  {row.ref ? ` · ${t("linkedTo", { ref: row.ref })}` : ""}
                </span>
              </span>

              <span className="ms-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("position", { position: index + 1 })}
                </span>
                <Switch
                  checked={row.isVisible}
                  disabled={!canManage}
                  aria-label={`${t("visible")} — ${row.title[locale]}`}
                  onCheckedChange={(isVisible) =>
                    setRows((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, isVisible } : item,
                      ),
                    )
                  }
                />
              </span>
            </div>
          )}
        />

        {canManage ? (
          <Button onClick={notSaved}>{tAdmin("actions.saveChanges")}</Button>
        ) : null}
      </TabsContent>

      <TabsContent value="banners" className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("banners.description")}
        </p>

        {banners.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium">{t("banners.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("banners.emptyDescription")}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {banners.map((banner) => (
              <li
                key={banner.id}
                className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-balance">
                    {banner.title[locale]}
                  </p>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {banner.subtitle[locale]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {banner.ctaLabel[locale]} → {banner.ctaHref}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ModuleStatusBadge
                    tone={banner.isVisible ? "success" : "muted"}
                  >
                    {banner.isVisible ? t("visible") : t("hidden")}
                  </ModuleStatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {banner.startsAt
                      ? t("banners.scheduled", {
                          from: formatDate(banner.startsAt, locale),
                          to: banner.endsAt
                            ? formatDate(banner.endsAt, locale)
                            : t("banners.openEnded"),
                        })
                      : t("banners.always")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
