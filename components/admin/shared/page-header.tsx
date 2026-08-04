import { cn } from "@/lib/utils";

/**
 * The heading block every admin page opens with.
 *
 * One component so the `h1`, the description and the action slot keep the same
 * spacing and the same order on every screen — a page that puts its primary
 * action on the left is a page that gets clicked wrongly.
 *
 * The heading is always `h1`: each admin route is its own page, not a section of
 * a larger one.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
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
  );
}
