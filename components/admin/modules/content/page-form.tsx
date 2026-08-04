"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { ModuleFormSection } from "@/components/admin/module/module-form";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleSeoPanel } from "@/components/admin/module/module-seo-panel";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { ContentPage } from "@/types/admin";

/**
 * The static page editor.
 *
 * Title, summary and body are all `LocalizedField`s — a privacy policy that
 * exists only in English is not a privacy policy for an Uzbek customer, and the
 * completeness badge makes the gap visible before publishing rather than after.
 *
 * The body is a plain textarea. A rich-text editor is a real dependency with
 * real sanitisation requirements, and choosing one belongs with the content
 * phase rather than being smuggled in here.
 */
export function PageForm({
  page,
  capabilities,
}: {
  page: ContentPage;
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule.
  const canManage = capabilities.update;
  const t = useTranslations("adminContent.pages.editor");
  const tAdmin = useTranslations("admin");
  const [draft, setDraft] = useState<ContentPage>(page);

  function set<K extends keyof ContentPage>(key: K, value: ContentPage[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      onSubmit={(event) => {
        event.preventDefault();
        toast(tAdmin("notSaved.title"), {
          description: tAdmin("notSaved.body"),
        });
      }}
    >
      <div className="space-y-6">
        <ModuleFormSection id="content" title={t("sections.content")}>
          <LocalizedField
            label={t("fields.title")}
            value={draft.title}
            disabled={!canManage}
            onChange={(title) => set("title", title)}
            required
          />
          <LocalizedField
            label={t("fields.excerpt")}
            value={draft.excerpt}
            multiline
            rows={2}
            disabled={!canManage}
            onChange={(excerpt) => set("excerpt", excerpt)}
          />
          <LocalizedField
            label={t("fields.body")}
            value={draft.body}
            multiline
            rows={12}
            disabled={!canManage}
            onChange={(body) => set("body", body)}
            required
          />
        </ModuleFormSection>

        <ModuleSeoPanel
          value={draft.seo}
          disabled={!canManage}
          onChange={(seo) => set("seo", seo)}
        />
      </div>

      <div className="space-y-6">
        <ModuleFormSection
          id="publishing"
          title={t("sections.publishing")}
          aside={
            <ModuleStatusBadge tone={draft.isPublished ? "success" : "neutral"}>
              {draft.isPublished
                ? tAdmin("status.published")
                : tAdmin("status.draft")}
            </ModuleStatusBadge>
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="page-slug">{t("fields.slug")}</Label>
            <Input
              id="page-slug"
              value={draft.slug}
              disabled={!canManage}
              className="font-mono"
              onChange={(event) => set("slug", event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="page-published" className="font-normal">
              {t("fields.published")}
            </Label>
            <Switch
              id="page-published"
              checked={draft.isPublished}
              disabled={!canManage}
              onCheckedChange={(isPublished) => set("isPublished", isPublished)}
            />
          </div>
        </ModuleFormSection>

        {canManage ? (
          <Button type="submit" className="w-full">
            <Save aria-hidden="true" />
            {tAdmin("actions.saveChanges")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
