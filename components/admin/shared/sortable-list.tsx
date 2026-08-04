"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A drag-to-reorder list with a keyboard equivalent.
 *
 * Used by both category ordering and the homepage section list — one
 * implementation, so the interaction and its accessibility are identical in both
 * places.
 *
 * **Dragging is never the only way.** WCAG 2.2 SC 2.5.7 requires a single-pointer
 * alternative to any dragging movement, and a keyboard user has no drag at all.
 * Every row therefore carries Move up / Move down buttons that do exactly what
 * the drag does. The buttons are the primary mechanism; the drag handle is the
 * convenience.
 *
 * Native HTML5 drag and drop rather than a library: the list is short, the
 * behaviour is a reorder within one container, and a 30 kB dependency to move
 * nine rows is not a trade worth making.
 *
 * Order changes are announced through a live region, because a silent visual
 * reshuffle tells a screen reader user nothing about what just happened.
 */
export type SortableItem = { id: string; label: string };

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: {
  items: readonly T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.actions");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);

    onReorder(next);
    setAnnouncement(`${moved.label} — ${to + 1} / ${items.length}`);
  }

  return (
    <>
      <ul className={cn("space-y-2", className)}>
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable={!disabled}
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={(event) => {
              // Without this the drop is rejected by the browser default.
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggingId) return;

              const from = items.findIndex((i) => i.id === draggingId);
              if (from !== -1 && from !== index) move(from, index);
              setDraggingId(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 transition-shadow",
              draggingId === item.id && "opacity-50 shadow-lg",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "shrink-0 text-muted-foreground",
                disabled ? "opacity-40" : "cursor-grab active:cursor-grabbing",
              )}
            >
              <GripVertical className="size-4" />
            </span>

            <div className="min-w-0 flex-1">{renderItem(item, index)}</div>

            <div className="flex shrink-0 flex-col gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                aria-label={`${t("moveUp")} — ${item.label}`}
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled || index === items.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label={`${t("moveDown")} — ${item.label}`}
              >
                <ChevronDown />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
