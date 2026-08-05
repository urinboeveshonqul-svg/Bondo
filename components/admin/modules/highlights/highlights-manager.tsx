"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteHighlight,
  reorderHighlights,
  saveHighlight,
  setHighlightVisibility,
} from "@/actions/service-highlights.actions";
import {
  HIGHLIGHT_ICON_NAMES,
  HighlightIcon,
} from "@/components/home/highlight-icon";
import { SortableList } from "@/components/admin/module/module-sortable-list";
import { ModuleEmptyState } from "@/components/admin/module/module-empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { cn } from "@/lib/utils";
import { locales, type Locale } from "@/lib/site-config";
import type { ServiceHighlight } from "@/services/service-highlights.service";

type Draft = {
  id?: string;
  icon: string;
  isVisible: boolean;
  translations: Record<Locale, { title: string; description: string }>;
};

const emptyDraft = (): Draft => ({
  icon: "ShieldCheck",
  isVisible: true,
  translations: Object.fromEntries(
    locales.map((locale) => [locale, { title: "", description: "" }]),
  ) as Draft["translations"],
});

const toDraft = (highlight: ServiceHighlight): Draft => ({
  id: highlight.id,
  icon: highlight.icon,
  isVisible: highlight.is_visible,
  translations: Object.fromEntries(
    locales.map((locale) => [
      locale,
      {
        title: highlight.title[locale] ?? "",
        description: highlight.description[locale] ?? "",
      },
    ]),
  ) as Draft["translations"],
});

/**
 * Service highlights.
 *
 * The trust row under the storefront hero, editable end to end: copy in three
 * languages, the icon, the order and whether each one is shown. Nothing about
 * the section is hardcoded, which is the point — a warranty period changing
 * should be a form, not a deploy.
 *
 * **Reordering saves immediately; editing saves on submit.** Dragging a row and
 * then having to press Save is how an operator loses an arrangement they thought
 * they had made, so the order is persisted the moment it changes. The dialog is
 * the opposite: half-typed copy in three languages must not reach the storefront
 * between keystrokes.
 *
 * The list is optimistic — the new order renders before the round trip and
 * reverts with a toast if the action refuses. A drag that visibly snaps back is
 * the clearest possible signal that the save did not happen.
 */
export function HighlightsManager({
  highlights,
  capabilities,
}: {
  highlights: readonly ServiceHighlight[];
  capabilities: ModuleCapabilities;
}) {
  const t = useTranslations("adminHighlights");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;

  const [rows, setRows] = useState<ServiceHighlight[]>(() => [...highlights]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const canManage = capabilities.update;
  const canCreate = capabilities.create;
  const canDelete = capabilities.delete;

  function failed(message?: string) {
    toast.error(t("errors.saveFailed"), { description: message });
  }

  function handleReorder(next: ServiceHighlight[]) {
    const previous = rows;
    setRows(next);

    startTransition(async () => {
      const result = await reorderHighlights({
        orderedIds: next.map((row) => row.id),
      });

      if (!result.ok) {
        setRows(previous);
        failed(result.error);
      }
    });
  }

  function handleVisibility(highlight: ServiceHighlight, isVisible: boolean) {
    const previous = rows;
    setRows((current) =>
      current.map((row) =>
        row.id === highlight.id ? { ...row, is_visible: isVisible } : row,
      ),
    );

    startTransition(async () => {
      const result = await setHighlightVisibility({
        id: highlight.id,
        isVisible,
      });

      if (!result.ok) {
        setRows(previous);
        failed(result.error);
      }
    });
  }

  function handleDelete(highlight: ServiceHighlight) {
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== highlight.id));

    startTransition(async () => {
      const result = await deleteHighlight({ id: highlight.id });

      if (!result.ok) {
        setRows(previous);
        failed(result.error);
      } else {
        toast.success(t("deleted"));
      }
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;

    startTransition(async () => {
      const result = await saveHighlight({
        ...(draft.id ? { id: draft.id } : {}),
        icon: draft.icon,
        // A new highlight goes to the end; an existing one keeps its place.
        displayOrder: draft.id
          ? (rows.find((row) => row.id === draft.id)?.display_order ??
            rows.length + 1)
          : rows.length + 1,
        isVisible: draft.isVisible,
        translations: draft.translations,
      });

      if (!result.ok) {
        failed(result.error);
        return;
      }

      setDraft(null);
      toast.success(t("saved"));
      // The server action revalidated the route; the list arrives as fresh
      // props rather than being patched here, so what shows is what was stored.
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        {canCreate ? (
          <Button onClick={() => setDraft(emptyDraft())}>
            <Plus className="size-4" aria-hidden="true" />
            {t("new")}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <ModuleEmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <SortableList
          items={rows.map((row) => ({
            id: row.id,
            label: row.title[locale] ?? row.icon,
            row,
          }))}
          disabled={!canManage || pending}
          onReorder={(next) => handleReorder(next.map((item) => item.row))}
          renderItem={({ row }) => (
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                className={cn(
                  "inline-flex shrink-0 rounded-lg p-2",
                  row.is_visible
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <HighlightIcon name={row.icon} className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {row.title[locale]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.description[locale]}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {canManage ? (
                  <Switch
                    checked={row.is_visible}
                    onCheckedChange={(next) => handleVisibility(row, next)}
                    aria-label={t("visibleLabel", {
                      name: row.title[locale] ?? "",
                    })}
                    disabled={pending}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {row.is_visible
                      ? tAdmin("visibility.public")
                      : tAdmin("visibility.hidden")}
                  </span>
                )}

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft(toDraft(row))}
                    aria-label={t("editLabel", {
                      name: row.title[locale] ?? "",
                    })}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}

                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(row)}
                    aria-label={t("deleteLabel", {
                      name: row.title[locale] ?? "",
                    })}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        />
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("editTitle") : t("newTitle")}
            </DialogTitle>
          </DialogHeader>

          {draft ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  {t("fields.icon")}
                </legend>
                {/* A radio group, not a select: seventeen glyphs are faster to
                    recognise than to read, and the whole set fits. */}
                <div className="flex flex-wrap gap-2">
                  {HIGHLIGHT_ICON_NAMES.map((name) => (
                    <label
                      key={name}
                      className={cn(
                        "inline-flex cursor-pointer rounded-lg border p-2.5 focus-within:ring-2 focus-within:ring-ring",
                        draft.icon === name
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name="icon"
                        value={name}
                        checked={draft.icon === name}
                        onChange={() => setDraft({ ...draft, icon: name })}
                        className="sr-only"
                      />
                      <HighlightIcon name={name} className="size-4" />
                      <span className="sr-only">{name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* All three languages, always — the action refuses a partial
                  save, so the tabs exist to make that reachable rather than to
                  make it optional. */}
              <Tabs defaultValue={locales[0]}>
                <TabsList>
                  {locales.map((code) => (
                    <TabsTrigger key={code} value={code}>
                      {code.toUpperCase()}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {locales.map((code) => (
                  <TabsContent key={code} value={code} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`title-${code}`}>
                        {t("fields.title")}
                      </Label>
                      <Input
                        id={`title-${code}`}
                        value={draft.translations[code].title}
                        maxLength={120}
                        required
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            translations: {
                              ...draft.translations,
                              [code]: {
                                ...draft.translations[code],
                                title: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`description-${code}`}>
                        {t("fields.description")}
                      </Label>
                      <Textarea
                        id={`description-${code}`}
                        value={draft.translations[code].description}
                        maxLength={400}
                        rows={3}
                        required
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            translations: {
                              ...draft.translations,
                              [code]: {
                                ...draft.translations[code],
                                description: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="flex items-center gap-2">
                <Switch
                  id="highlight-visible"
                  checked={draft.isVisible}
                  onCheckedChange={(next) =>
                    setDraft({ ...draft, isVisible: next })
                  }
                />
                <Label htmlFor="highlight-visible">
                  {t("fields.isVisible")}
                </Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                >
                  {tAdmin("actions.cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {tAdmin("actions.save")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
