"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteCategory,
  reorderCategories,
  saveCategory,
} from "@/actions/catalog.actions";
import { useRouter } from "@/i18n/navigation";

import {
  ModuleFormRow,
  ModuleFormSection,
} from "@/components/admin/module/module-form";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { SortableList } from "@/components/admin/module/module-sortable-list";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { Locale } from "@/lib/site-config";
import type { LocalizedText } from "@/types/catalog";

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
/**
 * A row as the database has it.
 *
 * Keyed by **id**, not slug. The mock version keyed on slug because a fixture's
 * slug was stable; a real one is editable, and keying a list on a field the form
 * can change is how a row loses its own identity mid-edit.
 *
 * `icon` and the invented `parentSlug` are gone — `categories` has a
 * `parent_id`, and there was never an icon column.
 */
export type AdminCategoryRow = {
  id: string;
  parentId: string | null;
  displayOrder: number;
  isVisible: boolean;
  name: LocalizedText;
  slug: LocalizedText;
  description: LocalizedText;
  productCount: number;
};

const EMPTY: LocalizedText = { uz: "", ru: "", en: "" };

/** A blank row for "new category", saved only once the operator submits. */
const blankCategory = (order: number): AdminCategoryRow => ({
  id: "",
  parentId: null,
  displayOrder: order,
  isVisible: true,
  name: { ...EMPTY },
  slug: { ...EMPTY },
  description: { ...EMPTY },
  productCount: 0,
});

export function CategoriesManager({
  categories,
  capabilities,
}: {
  categories: readonly AdminCategoryRow[];
  capabilities: ModuleCapabilities;
}) {
  // One prop in, resolved server-side from the module registry, so a screen
  // cannot invent its own permission rule.
  const canManage = capabilities.update;
  const t = useTranslations("adminCatalog.categories");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /**
   * The **draft** being edited, not a copy of the list.
   *
   * The list itself comes from the server on every render — the actions
   * revalidate, so what is on screen is what is in the database. Only the row
   * currently open in the editor is local, because a half-typed name must not
   * be a row anybody else can see.
   */
  const [draft, setDraft] = useState<AdminCategoryRow | null>(
    () => categories[0] ?? null,
  );

  const rows = categories;
  const selected = draft;

  function patch(changes: Partial<AdminCategoryRow>) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function persist(row: AdminCategoryRow) {
    startTransition(async () => {
      const result = await saveCategory({
        ...(row.id ? { id: row.id } : {}),
        parentId: row.parentId,
        displayOrder: row.displayOrder,
        isVisible: row.isVisible,
        name: row.name,
        slug: row.slug,
        description: row.description,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      router.refresh();
    });
  }

  function remove(row: AdminCategoryRow) {
    if (!row.id) {
      setDraft(null);
      return;
    }

    startTransition(async () => {
      const result = await deleteCategory({ id: row.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.delete"));
      setDraft(null);
      router.refresh();
    });
  }

  function persistOrder(next: readonly AdminCategoryRow[]) {
    startTransition(async () => {
      const result = await reorderCategories({
        orderedIds: next.map((row) => row.id).filter(Boolean),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="category-order" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="category-order" className="font-semibold tracking-tight">
            {t("columns.position")}
          </h2>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setDraft(blankCategory(rows.length + 1))}
            >
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
            id: row.id,
            label: row.name[locale],
          }))}
          disabled={!canManage || pending}
          onReorder={persistOrder}
          renderItem={(row) => (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft(row)}
                aria-current={row.id === draft?.id ? "true" : undefined}
                className="min-w-0 rounded-sm text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="block truncate text-sm font-medium">
                  {row.name[locale]}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t("productCount", { count: row.productCount })}
                </span>
              </button>

              <ModuleStatusBadge
                tone={row.isVisible ? "success" : "muted"}
                className="ms-auto"
              >
                {row.isVisible
                  ? tAdmin("status.visible")
                  : tAdmin("status.invisible")}
              </ModuleStatusBadge>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setDraft(row)}
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
            persist(selected);
          }}
        >
          <ModuleFormSection id="category" title={selected.name[locale]}>
            <LocalizedField
              label={t("fields.name")}
              value={selected.name}
              disabled={!canManage}
              onChange={(name) => patch({ name })}
              required
            />

            {/* The slug is per locale (ADR-52), so it gets the same treatment
                as the name rather than a single input that could only ever
                write one language. */}
            <LocalizedField
              label={t("fields.slug")}
              value={selected.slug}
              disabled={!canManage}
              onChange={(slug) => patch({ slug })}
              required
            />

            <LocalizedField
              label={t("fields.description")}
              value={selected.description}
              multiline
              rows={3}
              disabled={!canManage}
              onChange={(description) => patch({ description })}
            />

            <ModuleFormRow>
              <div className="space-y-1.5">
                <Label htmlFor="category-parent">{t("fields.parent")}</Label>
                <Select
                  value={selected.parentId ?? "__none"}
                  disabled={!canManage}
                  onValueChange={(value) =>
                    patch({ parentId: value === "__none" ? null : value })
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
                      .filter((row) => row.id && row.id !== selected.id)
                      .map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name[locale]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </ModuleFormRow>

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
                onCheckedChange={(isVisible) => patch({ isVisible })}
              />
            </div>
          </ModuleFormSection>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {tAdmin("actions.saveChanges")}
              </Button>
              {selected.id && capabilities.delete ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => remove(selected)}
                >
                  <Trash2 aria-hidden="true" />
                  {tAdmin("actions.delete")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
