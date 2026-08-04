"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";

import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocalizedText } from "@/types/catalog";

/**
 * The one media manager. Products, brands, categories, banners and pages all use
 * it — there is no second upload control anywhere in the panel.
 *
 * The duplication it prevents is not the file input, which is trivial. It is
 * everything around one: which bucket, the ordering, which image is primary,
 * the localized alt text, and the rule that the primary image is the one the
 * storefront uses as the Open Graph card. Five copies of that is five chances
 * for one module to forget alt text entirely.
 *
 * ## Alt text is localized and required-shaped
 *
 * `alt` is a `LocalizedText`, edited through the same `LocalizedField` as every
 * other translatable value, because "RTX 4090 graphics card" read aloud in
 * Russian is not alt text. Empty in a language is allowed and visible — the
 * translation status shows it — because refusing the upload would be worse than
 * an image nobody described yet.
 *
 * ## No image renders
 *
 * Deliberate, and not a placeholder: the panel has no product photography
 * (ADR-36 forbids fake catalog content, and a convincing fake photo is the one
 * piece of mock data that reads as finished work). A tile shows the file's
 * position and its path. When Storage is wired (**D-12**) this becomes a
 * `next/image` behind the same component and nothing else on any screen changes.
 *
 * ## Uploading is disabled, with the reason stated
 *
 * `onUpload` is optional and the button is disabled without it, carrying the
 * explanation. A file input that accepts a drop and silently discards it teaches
 * an operator that the workflow works.
 */

export type ModuleMediaItem = {
  id: string;
  /** Storage object path inside the module's bucket — never a URL. */
  path: string;
  alt: LocalizedText;
  position: number;
  isPrimary: boolean;
};

export function ModuleMediaManager({
  items,
  onChange,
  onUpload,
  canUpdate = true,
  maxItems,
  className,
}: {
  items: readonly ModuleMediaItem[];
  onChange: (next: ModuleMediaItem[]) => void;
  /** Omitted while Storage is unwired — the add button explains why (D-12). */
  onUpload?: () => void;
  canUpdate?: boolean;
  maxItems?: number;
  className?: string;
}) {
  const t = useTranslations("admin.media");

  const sorted = [...items].sort((a, b) => a.position - b.position);
  const atLimit = typeof maxItems === "number" && sorted.length >= maxItems;

  /** Rewrites `position` from array order, so the two can never disagree. */
  function commit(next: ModuleMediaItem[]) {
    onChange(next.map((item, index) => ({ ...item, position: index })));
  }

  function move(id: string, direction: -1 | 1) {
    const index = sorted.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;

    const next = [...sorted];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    commit(next);
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("count", { count: sorted.length })}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canUpdate || !onUpload || atLimit}
          title={onUpload ? undefined : t("unavailable")}
          onClick={onUpload}
        >
          <ImagePlus aria-hidden="true" />
          {t("add")}
        </Button>
      </div>

      {onUpload ? null : (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("unavailable")}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-4">
          {sorted.map((item, index) => (
            <li
              key={item.id}
              className="space-y-4 rounded-lg border p-4 sm:flex sm:items-start sm:gap-4 sm:space-y-0"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:items-stretch">
                <span
                  aria-hidden="true"
                  className="grid size-16 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground"
                >
                  {index + 1}
                </span>
                {item.isPrimary ? (
                  <ModuleStatusBadge tone="info">
                    {t("primary")}
                  </ModuleStatusBadge>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {item.path}
                </p>

                <LocalizedField
                  label={t("altLabel")}
                  hint={t("altHint")}
                  value={item.alt}
                  disabled={!canUpdate}
                  onChange={(alt) =>
                    commit(
                      sorted.map((current) =>
                        current.id === item.id ? { ...current, alt } : current,
                      ),
                    )
                  }
                />

                <div className="flex flex-wrap gap-2">
                  {/* Keyboard-operable reordering, not drag-and-drop. WCAG 2.2
                      SC 2.5.7 requires a non-dragging path, and a keyboard user
                      has no drag at all — the same decision the category tree
                      made. */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canUpdate || index === 0}
                    onClick={() => move(item.id, -1)}
                  >
                    <ArrowLeft aria-hidden="true" />
                    {t("moveEarlier")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canUpdate || index === sorted.length - 1}
                    onClick={() => move(item.id, 1)}
                  >
                    <ArrowRight aria-hidden="true" />
                    {t("moveLater")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canUpdate || item.isPrimary}
                    onClick={() =>
                      commit(
                        sorted.map((current) => ({
                          ...current,
                          isPrimary: current.id === item.id,
                        })),
                      )
                    }
                  >
                    <Star aria-hidden="true" />
                    {t("setPrimary")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canUpdate}
                    onClick={() => {
                      const remaining = sorted.filter(
                        (current) => current.id !== item.id,
                      );
                      // Removing the primary promotes the next one: a record
                      // with images but no primary has no share card and no
                      // thumbnail, and nothing on screen would say why.
                      if (item.isPrimary && remaining[0]) {
                        remaining[0] = { ...remaining[0], isPrimary: true };
                      }
                      commit(remaining);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("remove")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The single-image case — a brand logo, a category tile, a favicon.
 *
 * The same component underneath, capped at one and with the primary controls
 * suppressed, so a module never reaches for a second implementation just
 * because it holds one file.
 */
export function ModuleImageUploader({
  item,
  onChange,
  onUpload,
  canUpdate = true,
  className,
}: {
  item: ModuleMediaItem | null;
  onChange: (next: ModuleMediaItem | null) => void;
  onUpload?: () => void;
  canUpdate?: boolean;
  className?: string;
}) {
  return (
    <ModuleMediaManager
      items={item ? [{ ...item, isPrimary: true, position: 0 }] : []}
      onChange={(next) => onChange(next[0] ?? null)}
      onUpload={onUpload}
      canUpdate={canUpdate}
      maxItems={1}
      className={className}
    />
  );
}
