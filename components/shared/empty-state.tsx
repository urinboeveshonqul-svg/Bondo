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
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
