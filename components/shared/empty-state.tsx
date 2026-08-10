import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty state.
 *
 * ADR-20 exists because placeholder data hides these, so they are built as
 * first-class components rather than an afterthought — the cart, the wishlist
 * and a filter that matches nothing all render real ones today.
 *
 * `action` is a node rather than a label plus handler so the caller decides
 * whether it is a link or a button, and this component never needs to become a
 * Client Component to hold an `onClick`.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  /**
   * For an empty state that sits *inside* a populated page.
   *
   * A catalog listing that matches nothing already has its heading, its
   * category rows and its filters around it — the reader knows where they are,
   * so the empty box only has to say what happened. At full size it measured
   * 294px, which is a screen and a half on a phone spent saying "nothing here".
   *
   * The full size stays the default for the cases where the empty state *is*
   * the page: an empty basket, an empty wishlist.
   */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted text-muted-foreground",
          compact ? "p-2.5" : "p-3",
        )}
      >
        <Icon className={compact ? "size-5" : "size-6"} aria-hidden="true" />
      </div>
      <h3
        className={cn(
          "font-semibold tracking-tight",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </h3>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? (
        <div className={compact ? "mt-1" : "mt-2"}>{action}</div>
      ) : null}
    </div>
  );
}
