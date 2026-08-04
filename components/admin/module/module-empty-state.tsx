import { PackageSearch, type LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

/**
 * The empty state every module shows when it has nothing to list.
 *
 * A thin frame around the storefront's `EmptyState` — same component, same
 * spacing, same voice, so the admin and the shop do not develop two vocabularies
 * for "there is nothing here". The dashed border is the only difference: in the
 * admin it replaces a table, so it needs the shape of the thing it stands in for.
 *
 * **This stays a Server Component.** `action` is a node, so a caller passing a
 * link does not drag the empty state into the browser.
 *
 * ADR-20 is why this is a first-class component rather than a paragraph: no
 * seeded data means every list starts here, and the first screen an operator
 * sees on a new store is this one.
 */
export function ModuleEmptyState({
  icon = PackageSearch,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed", className)}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        action={action}
      />
    </div>
  );
}
