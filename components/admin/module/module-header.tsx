import {
  AdminBreadcrumbs,
  type Crumb,
} from "@/components/admin/layout/admin-breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * The block every module page opens with: trail, heading, description, actions.
 *
 * One component so the `h1`, the description and the action slot keep the same
 * spacing and the same order on every screen — a page that puts its primary
 * action on the left is a page that gets clicked wrongly.
 *
 * The breadcrumb is part of it rather than a separate call. Two components meant
 * two things to remember, and the one that got forgotten was the trail: a
 * product editor with no way back to the list except the sidebar.
 *
 * The heading is always `h1`: each admin route is its own page, not a section of
 * a larger one.
 *
 * Crumbs are passed in rather than derived from the URL — a path segment is an
 * id, not a name, and `/admin/products/c0000000-…` would put a UUID in the
 * trail.
 */
export function ModuleHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** The trail below "Admin". Omit on the dashboard, which is the root. */
  breadcrumbs?: readonly Crumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <AdminBreadcrumbs items={breadcrumbs} />
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
