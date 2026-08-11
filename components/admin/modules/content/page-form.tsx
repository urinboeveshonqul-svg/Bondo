"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { saveContentPage } from "@/actions/content-pages.actions";
import { ModuleFormSection } from "@/components/admin/module/module-form";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { locales } from "@/lib/site-config";
import type { EditableContentPage } from "@/types/admin";

/**
 * The static page editor.
 *
 * Title, summary and body are all `LocalizedField`s — a delivery policy that
 * exists only in English is not a delivery policy for an Uzbek customer, and the
 * completeness badge makes the gap visible before publishing rather than after.
 *
 * The body is a plain textarea over the three-rule syntax in ADR-76, not a
 * rich-text editor: the storefront parses `## `, `- ` and blank lines, and an
 * editor that emitted HTML would be emitting markup this renderer will print
 * as text.
 *
 * ## The SEO panel is gone, and that is not a regression
 *
 * It offered a per-locale canonical URL and a keyword list. `content_page_
 * translations` has `seo_title` and `seo_description`; it has no canonical
 * column at all, so three of the five fields could never be saved. What is here
 * now is the two that persist.
 */
export function PageForm({
  page,
  capabilities,
}: {
  page: EditableContentPage;
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule.
  const canManage = capabilities.update;
  const t = useTranslations("adminContent.pages.editor");
  const tAdmin = useTranslations("admin");
  const [draft, setDraft] = useState<EditableContentPage>(page);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function set<K extends keyof EditableContentPage>(
    key: K,
    value: EditableContentPage[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage) return;

    startTransition(async () => {
      const result = await saveContentPage({
        ...(draft.id ? { id: draft.id } : {}),
        key: draft.key,
        isPublished: draft.isPublished,
        displayOrder: draft.displayOrder,
        translations: Object.fromEntries(
          locales.map((locale) => [
            locale,
            {
              title: draft.title[locale],
              excerpt: draft.excerpt[locale],
              body: draft.body[locale],
              seoTitle: draft.seoTitle[locale],
              seoDescription: draft.seoDescription[locale],
            },
          ]),
        ) as Record<
          (typeof locales)[number],
          {
            title: string;
            excerpt: string;
            body: string;
            seoTitle: string;
            seoDescription: string;
          }
        >,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      onSubmit={onSubmit}
    >
      <div className="space-y-6">
        <ModuleFormSection id="content" title={t("sections.content")}>
          <LocalizedField
            label={t("fields.title")}
            value={draft.title}
            disabled={!canManage || pending}
            onChange={(title) => set("title", title)}
            required
          />
          <LocalizedField
            label={t("fields.excerpt")}
            value={draft.excerpt}
            multiline
            rows={2}
            disabled={!canManage || pending}
            onChange={(excerpt) => set("excerpt", excerpt)}
          />
          <LocalizedField
            label={t("fields.body")}
            value={draft.body}
            multiline
            rows={12}
            disabled={!canManage || pending}
            onChange={(body) => set("body", body)}
          />
        </ModuleFormSection>

        <ModuleFormSection id="seo" title={t("sections.seo")}>
          <LocalizedField
            label={t("fields.seoTitle")}
            value={draft.seoTitle}
            disabled={!canManage || pending}
            onChange={(seoTitle) => set("seoTitle", seoTitle)}
          />
          <LocalizedField
            label={t("fields.seoDescription")}
            value={draft.seoDescription}
            multiline
            rows={3}
            disabled={!canManage || pending}
            onChange={(seoDescription) => set("seoDescription", seoDescription)}
          />
        </ModuleFormSection>
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
            <Label htmlFor="page-key">{t("fields.slug")}</Label>
            <Input
              id="page-key"
              value={draft.key}
              // The key is the storefront path and the primary lookup for five
              // hard-coded info routes. Renaming it would 404 the page it names,
              // so it is shown and not edited once the row exists.
              disabled={!canManage || pending || Boolean(draft.id)}
              className="font-mono"
              onChange={(event) => set("key", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.slugHint")}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="page-published" className="font-normal">
              {t("fields.published")}
            </Label>
            <Switch
              id="page-published"
              checked={draft.isPublished}
              disabled={!canManage || pending}
              onCheckedChange={(isPublished) => set("isPublished", isPublished)}
            />
          </div>
        </ModuleFormSection>

        {canManage ? (
          <Button type="submit" className="w-full" disabled={pending}>
            <Save aria-hidden="true" />
            {tAdmin("actions.saveChanges")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
