"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import {
  deleteCategory,
  reorderCategories,
  saveCategory,
  setCategoryVisibility,
} from "@/actions/catalog.actions";
import { useRouter } from "@/i18n/navigation";

import { ModuleForm } from "@/components/admin/module/module-form";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleSeoPanel } from "@/components/admin/module/module-seo-panel";
import { CategoryIconPicker } from "@/components/admin/modules/categories/category-icon-picker";
import { CategoryImageField } from "@/components/admin/modules/categories/category-image-field";
import {
  CategoryTree,
  ancestorLabels,
  type CategoryMove,
  type CategoryTreeRow,
} from "@/components/admin/modules/categories/category-tree";
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
import { locales, type Locale } from "@/lib/site-config";
import type { SeoFields } from "@/types/admin";
import type { LocalizedText } from "@/types/catalog";

/**
 * Category management: the tree on the left, an editor on the right.
 *
 * Everything on this screen persists. Nothing on it is hardcoded — the twelve
 * departments and their ninety subcategories are rows shipped by a migration
 * (ADR-72), and every one of them can be renamed, re-parented, re-ordered,
 * hidden, re-iconed, given an image, translated, given SEO copy or deleted from
 * here without a deploy.
 *
 * ## The list is not local state
 *
 * `categories` comes from the server on every render. The actions revalidate, so
 * what is on screen is what is in the database — a client-side copy of the tree
 * would be one failed save away from showing an arrangement nobody has.
 *
 * Only the row **currently open in the editor** is local, because a half-typed
 * name in three languages must not be a row anybody else can see.
 *
 * ## Reordering saves immediately; editing saves on submit
 *
 * Dragging a category and then having to press Save is how an operator loses an
 * arrangement they thought they made. The editor is the opposite: a category
 * whose Russian name is three characters in must not reach the storefront
 * between keystrokes. Same split as the highlights module, for the same reason.
 *
 * ## A row is keyed by `id`
 *
 * Not by slug. The slug is editable, per locale (ADR-52), and keying a list on
 * a field the form can change is how a row loses its identity mid-edit.
 */
export type AdminCategoryRow = {
  id: string;
  parentId: string | null;
  displayOrder: number;
  isVisible: boolean;
  isFeatured: boolean;
  icon: string | null;
  imagePath: string | null;
  /** Resolved server-side from `imagePath`; `""` when there is none. */
  imageUrl: string;
  name: LocalizedText;
  slug: LocalizedText;
  description: LocalizedText;
  seo: SeoFields;
  isTranslationComplete: boolean;
  productCount: number;
};

const EMPTY: LocalizedText = { uz: "", ru: "", en: "" };

const emptyText = (): LocalizedText => ({ ...EMPTY });

const blankSeo = (): SeoFields => ({
  slug: null,
  metaTitle: emptyText(),
  metaDescription: emptyText(),
  keywords: [],
  canonicalUrl: emptyText(),
  ogTitle: emptyText(),
  ogDescription: emptyText(),
  ogImagePath: null,
  twitterCard: null,
});

/** A blank row, saved only once the operator submits. */
const blankCategory = (parentId: string | null): AdminCategoryRow => ({
  id: "",
  parentId,
  displayOrder: 0,
  isVisible: true,
  isFeatured: false,
  icon: null,
  imagePath: null,
  imageUrl: "",
  name: emptyText(),
  slug: emptyText(),
  description: emptyText(),
  seo: blankSeo(),
  isTranslationComplete: false,
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
  const [draft, setDraft] = useState<AdminCategoryRow | null>(null);

  const tree = buildTree(categories, locale);
  const trail = draft?.id ? ancestorLabels(tree, draft.id) : null;

  function patch(changes: Partial<AdminCategoryRow>) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function run(
    work: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success?: string,
  ) {
    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        // `err()` always carries a message, so there is nothing to fall back to
        // — a generic "something went wrong" here would replace a sentence the
        // service wrote specifically for this failure.
        toast.error(result.error);
        return;
      }

      if (success) toast.success(success);
      router.refresh();
    });
  }

  function persist(row: AdminCategoryRow) {
    run(async () => {
      const result = await saveCategory({
        ...(row.id ? { id: row.id } : {}),
        parentId: row.parentId,
        displayOrder: row.displayOrder,
        isVisible: row.isVisible,
        isFeatured: row.isFeatured,
        icon: row.icon,
        imagePath: row.imagePath,
        name: row.name,
        slug: row.slug,
        description: row.description,
        seoTitle: row.seo.metaTitle,
        seoDescription: row.seo.metaDescription,
        seoKeywords: [...row.seo.keywords],
        canonicalUrl: row.seo.canonicalUrl,
        ogTitle: row.seo.ogTitle,
        ogDescription: row.seo.ogDescription,
        ogImagePath: row.seo.ogImagePath,
        twitterCard: row.seo.twitterCard,
      });

      // A newly created category has an id now, so the editor stops being a
      // "new" form — without this the next Save would create a second one.
      if (result.ok && !row.id) {
        setDraft({ ...row, id: result.data.id });
      }

      return result;
    }, tAdmin("actions.save"));
  }

  function remove(row: AdminCategoryRow) {
    if (!row.id) {
      setDraft(null);
      return;
    }

    run(async () => {
      const result = await deleteCategory({ id: row.id });
      if (result.ok) setDraft(null);
      return result;
    }, tAdmin("actions.delete"));
  }

  /**
   * Persists a drag or a keyboard move.
   *
   * Sends the **whole destination sibling group** in one call, so the moved
   * category's new parent and every affected position are written together or
   * not at all. A cycle comes back as a refusal from the database trigger and is
   * surfaced as an error toast — the tree filters the obvious cases, but it is
   * the trigger that decides (ADR-26).
   */
  function move(next: CategoryMove) {
    run(() =>
      reorderCategories({
        parentId: next.parentId,
        orderedIds: next.orderedIds,
      }),
    );
  }

  function toggleVisibility(row: CategoryTreeRow) {
    run(() => setCategoryVisibility({ id: row.id, isVisible: !row.isVisible }));
  }

  function edit(row: CategoryTreeRow) {
    const found = categories.find((item) => item.id === row.id);
    if (found) setDraft(found);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="category-tree" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="category-tree" className="font-semibold tracking-tight">
            {t("treeHeading")}
          </h2>
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setDraft(blankCategory(null))}
            >
              <Plus aria-hidden="true" />
              {t("new")}
            </Button>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">{t("reorderHint")}</p>

        <CategoryTree
          rows={tree}
          selectedId={draft?.id || null}
          disabled={!canManage || pending}
          onSelect={edit}
          onMove={move}
          onToggleVisibility={toggleVisibility}
          onAddChild={(parent) => setDraft(blankCategory(parent.id))}
        />
      </section>

      {draft ? (
        <ModuleForm
          onSubmit={(event) => {
            event.preventDefault();
            persist(draft);
          }}
          sections={{
            general: {
              title: draft.id
                ? (trail?.join(" › ") ?? draft.name[locale])
                : t("newTitle"),
              children: (
                <div className="space-y-5">
                  <LocalizedField
                    label={t("fields.name")}
                    value={draft.name}
                    disabled={!canManage}
                    onChange={(name) => patch({ name })}
                    required
                  />

                  {/*
                    The slug is per locale (ADR-52), so it gets the same
                    treatment as the name rather than a single input that could
                    only ever write one language.
                  */}
                  <LocalizedField
                    label={t("fields.slug")}
                    hint={t("fields.slugHint")}
                    value={draft.slug}
                    disabled={!canManage}
                    onChange={(slug) => patch({ slug })}
                    required
                  />

                  <LocalizedField
                    label={t("fields.description")}
                    value={draft.description}
                    multiline
                    rows={3}
                    disabled={!canManage}
                    onChange={(description) => patch({ description })}
                  />

                  <div className="space-y-1.5">
                    <Label htmlFor="category-parent">
                      {t("fields.parent")}
                    </Label>
                    <Select
                      value={draft.parentId ?? "__none"}
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
                        {parentOptions(categories, draft, locale).map(
                          (option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("fields.parentHint")}
                    </p>
                  </div>

                  <CategoryIconPicker
                    value={draft.icon}
                    disabled={!canManage}
                    onChange={(icon) => patch({ icon })}
                  />
                </div>
              ),
            },

            media: {
              children: (
                <CategoryImageField
                  categoryId={draft.id}
                  path={draft.imagePath}
                  url={draft.imageUrl}
                  disabled={!canManage}
                  onChange={({ path, url }) =>
                    patch({ imagePath: path, imageUrl: url })
                  }
                />
              ),
            },

            seo: {
              children: (
                <ModuleSeoPanel
                  value={draft.seo}
                  disabled={!canManage}
                  onChange={(seo) => patch({ seo })}
                />
              ),
            },

            publish: {
              children: (
                <div className="space-y-3">
                  <ToggleRow
                    id="category-visible"
                    label={t("fields.visible")}
                    hint={t("fields.visibleHint")}
                    checked={draft.isVisible}
                    disabled={!canManage}
                    onChange={(isVisible) => patch({ isVisible })}
                  />

                  <ToggleRow
                    id="category-featured"
                    label={t("fields.featured")}
                    hint={t("fields.featuredHint")}
                    checked={draft.isFeatured}
                    disabled={!canManage}
                    onChange={(isFeatured) => patch({ isFeatured })}
                  />
                </div>
              ),
            },
          }}
          actions={
            canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {tAdmin("actions.saveChanges")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setDraft(null)}
                >
                  {tAdmin("actions.cancel")}
                </Button>
                {draft.id && capabilities.delete ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => remove(draft)}
                  >
                    <Trash2 aria-hidden="true" />
                    {tAdmin("actions.delete")}
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        />
      ) : (
        <p className="self-start rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("selectToEdit")}
        </p>
      )}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/**
 * Folds the flat admin rows into the tree the list renders.
 *
 * The server sends the categories flat and ordered — the same shape
 * `listCategories` returns — and this nests them. Depth is unlimited; an orphan
 * whose parent is missing is attached at the root rather than dropped, so a row
 * cannot disappear from the only screen that could fix it.
 */
function buildTree(
  categories: readonly AdminCategoryRow[],
  locale: Locale,
): CategoryTreeRow[] {
  const nodes = new Map<string, CategoryTreeRow>(
    categories.map((category) => [
      category.id,
      {
        id: category.id,
        parentId: category.parentId,
        // Falls back to any language that has a name: a category translated in
        // Russian only must still be findable on the Uzbek admin, or it becomes
        // an unlabelled row nobody can select to fix.
        label:
          category.name[locale] ||
          locales.map((other) => category.name[other]).find(Boolean) ||
          category.slug[locale] ||
          "—",
        icon: category.icon,
        isVisible: category.isVisible,
        isFeatured: category.isFeatured,
        productCount: category.productCount,
        isTranslationComplete: category.isTranslationComplete,
        children: [],
      },
    ]),
  );

  const roots: CategoryTreeRow[] = [];

  for (const category of categories) {
    const node = nodes.get(category.id);
    if (!node) continue;

    const parent = category.parentId ? nodes.get(category.parentId) : undefined;

    if (parent) parent.children.push(node);
    else {
      // An orphan is shown at the root, and its `parentId` is corrected to match
      // so the move buttons compute against where it actually appears.
      node.parentId = null;
      roots.push(node);
    }
  }

  return roots;
}

/**
 * The categories a row may be re-parented to.
 *
 * Excludes itself and everything beneath it, because both would be a cycle —
 * the database trigger refuses them anyway (ADR-26), and offering a choice the
 * save will reject is worse than not offering it.
 */
function parentOptions(
  categories: readonly AdminCategoryRow[],
  draft: AdminCategoryRow,
  locale: Locale,
): { id: string; label: string }[] {
  const descendants = new Set<string>();

  if (draft.id) {
    descendants.add(draft.id);

    // The list is ordered parent-before-child by `path`, so one pass is enough
    // to close the set over any depth.
    for (const category of categories) {
      if (category.parentId && descendants.has(category.parentId)) {
        descendants.add(category.id);
      }
    }
  }

  const label = (category: AdminCategoryRow) =>
    category.name[locale] ||
    locales.map((other) => category.name[other]).find(Boolean) ||
    "—";

  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories
    .filter((category) => category.id && !descendants.has(category.id))
    .map((category) => {
      // Ancestors in the label, so two subcategories called "Home" are
      // distinguishable in a flat select.
      const parts: string[] = [];
      let current: AdminCategoryRow | undefined = category;

      while (current) {
        parts.unshift(label(current));
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }

      return { id: category.id, label: parts.join(" › ") };
    });
}
