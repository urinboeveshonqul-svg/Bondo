"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus } from "lucide-react";

import { FormRow, FormSection } from "@/components/admin/form/form-section";
import { LocalizedField } from "@/components/admin/form/localized-field";
import { SortableList } from "@/components/admin/shared/sortable-list";
import { StatusBadge } from "@/components/admin/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Locale } from "@/lib/site-config";
import type { Category } from "@/types/catalog";

/**
 * Category management: ordering on the left, an editor on the right.
 *
 * The tree is a flat ordered list plus a parent reference, which is what
 * `public.categories` stores — it supports unlimited depth and rejects cycles.
 * Rendering it as an ordered list rather than a nested tree keeps drag-to-reorder
 * meaningful; depth is expressed by the parent select rather than by indentation
 * an operator has to drag across.
 *
 * Selecting a row loads it into the editor beside the list rather than opening a
 * dialog. Reordering and editing are the two things done here, usually in the
 * same sitting, and a modal makes them alternate instead of coexist.
 */
type EditableCategory = Category & {
  isVisible: boolean;
  icon: string;
  parentSlug: string | null;
};

export function CategoriesManager({
  categories,
  canManage,
}: {
  categories: readonly Category[];
  canManage: boolean;
}) {
  const t = useTranslations("adminCatalog.categories");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [rows, setRows] = useState<EditableCategory[]>(() =>
    categories.map((category) => ({
      ...category,
      isVisible: true,
      icon: "",
      parentSlug: null,
    })),
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    categories[0]?.slug ?? null,
  );

  const selected = rows.find((row) => row.slug === selectedSlug) ?? null;

  function patch(slug: string, changes: Partial<EditableCategory>) {
    setRows((current) =>
      current.map((row) => (row.slug === slug ? { ...row, ...changes } : row)),
    );
  }

  function notSaved() {
    toast(tAdmin("notSaved.title"), { description: tAdmin("notSaved.body") });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="category-order" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="category-order" className="font-semibold tracking-tight">
            {t("columns.position")}
          </h2>
          {canManage ? (
            <Button size="sm" variant="outline" onClick={notSaved}>
              <Plus aria-hidden="true" />
              {t("new")}
            </Button>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">{t("reorderHint")}</p>

        <SortableList
          // `SortableList` needs an `id` and a `label`; a category is keyed by
          // slug and labelled in the active language.
          items={rows.map((row) => ({
            ...row,
            id: row.slug,
            label: row.name[locale],
          }))}
          disabled={!canManage}
          onReorder={(next) => setRows(next)}
          renderItem={(row) => (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSlug(row.slug)}
                aria-current={row.slug === selectedSlug ? "true" : undefined}
                className="min-w-0 rounded-sm text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="block truncate text-sm font-medium">
                  {row.name[locale]}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t("productCount", { count: row.productCount })}
                </span>
              </button>

              <StatusBadge
                tone={row.isVisible ? "success" : "muted"}
                className="ms-auto"
              >
                {row.isVisible
                  ? tAdmin("status.visible")
                  : tAdmin("status.invisible")}
              </StatusBadge>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedSlug(row.slug)}
                aria-label={`${tAdmin("actions.edit")} — ${row.name[locale]}`}
              >
                <Pencil />
              </Button>
            </div>
          )}
        />
      </section>

      {selected ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            notSaved();
          }}
        >
          <FormSection id="category" title={selected.name[locale]}>
            <LocalizedField
              label={t("fields.name")}
              value={selected.name}
              disabled={!canManage}
              onChange={(name) => patch(selected.slug, { name })}
              required
            />

            <LocalizedField
              label={t("fields.description")}
              value={selected.description}
              multiline
              rows={3}
              disabled={!canManage}
              onChange={(description) => patch(selected.slug, { description })}
            />

            <FormRow>
              <div className="space-y-1.5">
                <Label htmlFor="category-slug">{t("fields.slug")}</Label>
                <Input
                  id="category-slug"
                  value={selected.slug}
                  disabled={!canManage}
                  onChange={(event) =>
                    patch(selected.slug, { slug: event.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category-parent">{t("fields.parent")}</Label>
                <Select
                  value={selected.parentSlug ?? "__none"}
                  disabled={!canManage}
                  onValueChange={(value) =>
                    patch(selected.slug, {
                      parentSlug: value === "__none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="category-parent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">
                      {t("fields.noParent")}
                    </SelectItem>
                    {rows
                      // A category cannot be its own parent. Deeper cycles are
                      // rejected by the database trigger; this stops the
                      // one-step case reaching it at all.
                      .filter((row) => row.slug !== selected.slug)
                      .map((row) => (
                        <SelectItem key={row.slug} value={row.slug}>
                          {row.name[locale]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </FormRow>

            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="category-visible" className="font-normal">
                {selected.isVisible ? (
                  <Eye className="size-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="size-4" aria-hidden="true" />
                )}
                {t("fields.visible")}
              </Label>
              <Switch
                id="category-visible"
                checked={selected.isVisible}
                disabled={!canManage}
                onCheckedChange={(isVisible) =>
                  patch(selected.slug, { isVisible })
                }
              />
            </div>
          </FormSection>

          {canManage ? (
            <Button type="submit">{tAdmin("actions.saveChanges")}</Button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
