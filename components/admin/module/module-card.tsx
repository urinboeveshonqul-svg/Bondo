import { cn } from "@/lib/utils";

/**
 * The card a module uses when a row is not the right shape — a static page, a
 * homepage band, a role.
 *
 * It exists so those screens are not "the ones that look different". The border,
 * radius, padding and internal rhythm are the same as `ModuleFormSection` and
 * `StatCard`, so a page of cards and a page of sections sit on the same grid.
 *
 * A Server Component, and it must stay one: these render in lists of thirty and
 * carry no interaction of their own. `actions` is a node, so a caller putting a
 * button inside does not pull the card into the browser with it.
 *
 * The whole card is deliberately **not** a link. A card with a link over it and
 * buttons inside it produces nested interactive elements, which is invalid HTML
 * and behaves differently in every screen reader; the title carries the link
 * instead.
 */
export function ModuleCard({
  title,
  subtitle,
  badge,
  actions,
  footer,
  children,
  className,
}: {
  /** A node so the caller can make it a link without this component knowing. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Usually a `ModuleStatusBadge`. */
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate font-medium">{title}</h2>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badge}
      </div>

      {children ? <div className="flex-1 text-sm">{children}</div> : null}

      {footer || actions ? (
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {footer}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
