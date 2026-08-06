"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Pencil,
  Plus,
  Star,
} from "lucide-react";

import { CategoryIcon } from "@/components/layout/category-icon";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The category tree: drag to arrange, buttons to do the same thing.
 *
 * The list is a real tree of unlimited depth, not the flat ordered list the
 * previous manager rendered. That was defensible while the taxonomy was flat;
 * with twelve departments and ninety subcategories a flat list is unusable, and
 * "which department is this under" becomes a question the operator answers by
 * reading a select rather than by looking.
 *
 * ## Four movements, and each has a keyboard equivalent
 *
 * WCAG 2.2 SC 2.5.7 requires a single-pointer alternative to any dragging
 * movement, and a keyboard user has no drag at all. So every row carries four
 * buttons that do exactly what a drag does:
 *
 * | Button   | Movement                                              |
 * | -------- | ----------------------------------------------------- |
 * | Up       | Swap with the previous sibling                        |
 * | Down     | Swap with the next sibling                            |
 * | Indent   | Become the last child of the previous sibling         |
 * | Outdent  | Become the next sibling of the current parent         |
 *
 * The buttons are the primary mechanism and the drag handle is the convenience,
 * which is the same stance `SortableList` takes. Each is disabled when it would
 * be a no-op, so an operator can tell what is possible without trying it.
 *
 * ## Two drop targets per row
 *
 * Dragging is ambiguous in a tree — "onto Components" could mean *before* it or
 * *inside* it — so the ambiguity is resolved by making them different targets:
 *
 *   * the **line above a row** inserts the dragged category at that position
 *     among that row's siblings;
 *   * the **row itself** makes the dragged category its last child.
 *
 * Both are highlighted while a drag is over them, so the operator sees which
 * one they are about to hit before releasing.
 *
 * Native HTML5 drag and drop rather than a library: this is a reorder inside one
 * container, and a 30 kB dependency for it is not a trade worth making.
 *
 * ## The move is refused, not prevented, when it would build a cycle
 *
 * Dropping a department onto its own subcategory is filtered out here for the
 * obvious cases, but the real guard is the database trigger — it is the only
 * thing that sees the whole tree atomically (ADR-26), and this component's copy
 * can be one save out of date. A refusal comes back as an error toast rather
 * than as a silently ignored drag.
 *
 * Order changes are announced through a live region, because a silent visual
 * reshuffle tells a screen reader user nothing about what just happened.
 */
export type CategoryTreeRow = {
  id: string;
  parentId: string | null;
  label: string;
  icon: string | null;
  isVisible: boolean;
  isFeatured: boolean;
  productCount: number;
  isTranslationComplete: boolean;
  children: CategoryTreeRow[];
};

/** Where a dragged category is going. */
export type CategoryMove = {
  id: string;
  parentId: string | null;
  /** The full ordered id list of the destination sibling group, after the move. */
  orderedIds: string[];
};

export function CategoryTree({
  rows,
  selectedId,
  disabled = false,
  onSelect,
  onMove,
  onToggleVisibility,
  onAddChild,
}: {
  rows: readonly CategoryTreeRow[];
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (row: CategoryTreeRow) => void;
  onMove: (move: CategoryMove) => void;
  onToggleVisibility: (row: CategoryTreeRow) => void;
  onAddChild: (parent: CategoryTreeRow) => void;
}) {
  const t = useTranslations("adminCatalog.categories");
  const tAction = useTranslations("admin.actions");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  /** Every row, flattened, so a lookup does not walk the tree each time. */
  const index = new Map<string, CategoryTreeRow>();
  const walk = (list: readonly CategoryTreeRow[]) => {
    for (const row of list) {
      index.set(row.id, row);
      walk(row.children);
    }
  };
  walk(rows);

  function siblingsOf(parentId: string | null): CategoryTreeRow[] {
    if (parentId === null) return [...rows];
    return [...(index.get(parentId)?.children ?? [])];
  }

  /** Whether `candidate` is `row` or sits beneath it — a move there is a cycle. */
  function isSelfOrDescendant(
    row: CategoryTreeRow,
    candidateId: string,
  ): boolean {
    if (row.id === candidateId) return true;
    return row.children.some((child) => isSelfOrDescendant(child, candidateId));
  }

  function commit(row: CategoryTreeRow, parentId: string | null, at: number) {
    const group = siblingsOf(parentId).filter((item) => item.id !== row.id);
    group.splice(at, 0, row);

    onMove({ id: row.id, parentId, orderedIds: group.map((item) => item.id) });
    setAnnouncement(`${row.label} — ${at + 1} / ${group.length}`);
  }

  function moveWithin(row: CategoryTreeRow, delta: number) {
    const group = siblingsOf(row.parentId);
    const from = group.findIndex((item) => item.id === row.id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= group.length) return;

    commit(row, row.parentId, to);
  }

  /** Becomes the last child of the sibling above it. */
  function indent(row: CategoryTreeRow) {
    const group = siblingsOf(row.parentId);
    const at = group.findIndex((item) => item.id === row.id);
    const previous = at > 0 ? group[at - 1] : undefined;
    if (!previous) return;

    commit(row, previous.id, previous.children.length);
  }

  /** Becomes the next sibling of its own parent. */
  function outdent(row: CategoryTreeRow) {
    if (!row.parentId) return;

    const parent = index.get(row.parentId);
    if (!parent) return;

    const grandparentGroup = siblingsOf(parent.parentId);
    const at = grandparentGroup.findIndex((item) => item.id === parent.id);

    commit(row, parent.parentId, at + 1);
  }

  function handleDrop(target: CategoryTreeRow, mode: "before" | "inside") {
    const dragged = draggingId ? index.get(draggingId) : undefined;
    setDraggingId(null);
    setDropTarget(null);

    if (!dragged || dragged.id === target.id) return;
    // The obvious cycle, caught here so the common mistake never becomes a
    // failed round trip. The trigger is still the guard for the rest.
    if (isSelfOrDescendant(dragged, target.id)) return;

    if (mode === "inside") {
      commit(dragged, target.id, target.children.length);
      return;
    }

    const group = siblingsOf(target.parentId).filter(
      (item) => item.id !== dragged.id,
    );
    const at = group.findIndex((item) => item.id === target.id);

    commit(dragged, target.parentId, at === -1 ? group.length : at);
  }

  function renderRows(list: readonly CategoryTreeRow[], depth: number) {
    return (
      <ul className={cn("space-y-1", depth > 0 && "ms-4 border-s ps-3")}>
        {list.map((row, position) => {
          const group = list;
          const hasParent = row.parentId !== null;

          return (
            <li key={row.id}>
              {/*
                The insert line. 8px tall and invisible until something is
                dragged over it — a permanently visible gap between every row
                would make a ninety-row tree twice as tall for a hint nobody
                needs while not dragging.
              */}
              <div
                aria-hidden="true"
                onDragOver={(event) => {
                  if (!draggingId) return;
                  event.preventDefault();
                  setDropTarget(`before:${row.id}`);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(row, "before");
                }}
                className={cn(
                  "h-2 rounded-full transition-colors",
                  dropTarget === `before:${row.id}` && "bg-primary",
                )}
              />

              <div
                draggable={!disabled}
                onDragStart={() => setDraggingId(row.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  if (!draggingId || draggingId === row.id) return;
                  event.preventDefault();
                  setDropTarget(`inside:${row.id}`);
                }}
                onDragLeave={() => {
                  setDropTarget((current) =>
                    current === `inside:${row.id}` ? null : current,
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(row, "inside");
                }}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 transition-shadow",
                  draggingId === row.id && "opacity-50 shadow-lg",
                  dropTarget === `inside:${row.id}` &&
                    "border-primary ring-2 ring-primary/40",
                  selectedId === row.id && "border-primary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 text-muted-foreground",
                    disabled
                      ? "opacity-40"
                      : "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <GripVertical className="size-4" />
                </span>

                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  aria-current={selectedId === row.id ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-start focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <CategoryIcon
                    name={row.icon}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {row.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("productCount", { count: row.productCount })}
                      {row.children.length > 0
                        ? ` · ${t("childCount", { count: row.children.length })}`
                        : ""}
                    </span>
                  </span>
                </button>

                {row.isFeatured ? (
                  <Star
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-label={t("fields.featured")}
                  />
                ) : null}

                {!row.isTranslationComplete ? (
                  <ModuleStatusBadge tone="warning">
                    {t("untranslated")}
                  </ModuleStatusBadge>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onToggleVisibility(row)}
                  aria-label={`${
                    row.isVisible ? tAction("hide") : tAction("show")
                  } — ${row.label}`}
                >
                  {row.isVisible ? <Eye /> : <EyeOff />}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => onAddChild(row)}
                  aria-label={`${t("newChild")} — ${row.label}`}
                >
                  <Plus />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onSelect(row)}
                  aria-label={`${tAction("edit")} — ${row.label}`}
                >
                  <Pencil />
                </Button>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || position === 0}
                    onClick={() => moveWithin(row, -1)}
                    aria-label={`${tAction("moveUp")} — ${row.label}`}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || position === group.length - 1}
                    onClick={() => moveWithin(row, 1)}
                    aria-label={`${tAction("moveDown")} — ${row.label}`}
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || position === 0}
                    onClick={() => indent(row)}
                    aria-label={`${tAction("indent")} — ${row.label}`}
                  >
                    <IndentIncrease />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || !hasParent}
                    onClick={() => outdent(row)}
                    aria-label={`${tAction("outdent")} — ${row.label}`}
                  >
                    <IndentDecrease />
                  </Button>
                </div>
              </div>

              {row.children.length > 0 ? (
                <div className="mt-1">
                  {renderRows(row.children, depth + 1)}
                </div>
              ) : null}
            </li>
          );
        })}

        {/*
          The tail target. Without it there is nowhere to drop a category so it
          becomes the *last* item in a group — every insert line sits above a
          row, so the final position is unreachable by drag.
        */}
        {list.length > 0 && list[list.length - 1] ? (
          <li>
            <div
              aria-hidden="true"
              onDragOver={(event) => {
                if (!draggingId) return;
                event.preventDefault();
                setDropTarget("end");
              }}
              onDrop={(event) => {
                event.preventDefault();

                const dragged = draggingId ? index.get(draggingId) : undefined;
                setDraggingId(null);
                setDropTarget(null);
                if (!dragged) return;

                const last = list[list.length - 1];
                if (!last) return;

                const group = siblingsOf(last.parentId).filter(
                  (item) => item.id !== dragged.id,
                );

                commit(dragged, last.parentId, group.length);
              }}
              className={cn(
                "h-2 rounded-full transition-colors",
                dropTarget === "end" && "bg-primary",
              )}
            />
          </li>
        ) : null}
      </ul>
    );
  }

  return (
    <>
      {rows.length > 0 ? (
        renderRows(rows, 0)
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("emptyTree")}
        </p>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

/** A breadcrumb of a category's ancestors, for the editor heading. */
export function ancestorLabels(
  rows: readonly CategoryTreeRow[],
  id: string,
  trail: string[] = [],
): string[] | null {
  for (const row of rows) {
    const next = [...trail, row.label];
    if (row.id === id) return next;

    const found = ancestorLabels(row.children, id, next);
    if (found) return found;
  }

  return null;
}
