import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The loading placeholder every module shows while its data is in flight.
 *
 * Three shapes, matching the three ways a module renders: a table, a grid of
 * cards, a form. Each mirrors the real layout closely enough that nothing jumps
 * when the content arrives — a spinner in the middle of the page is replaced by
 * a table, and the whole viewport shifts.
 *
 * `aria-busy` plus a visually hidden label, because a screen reader gets nothing
 * from a grey rectangle. The skeleton itself is `aria-hidden`: announcing twelve
 * placeholder cells is worse than announcing none.
 *
 * Used from a route's `loading.tsx` once modules fetch (**D-2**, Phase 6). Until
 * then a module renders synchronously from mock data and has nothing to wait
 * for, so these are used by the drawer and by anything behind a `<Suspense>`.
 */
export function ModuleLoadingState({
  variant = "table",
  rows = 6,
  label,
  className,
}: {
  variant?: "table" | "cards" | "form";
  rows?: number;
  /** Already translated. Announced to assistive technology. */
  label: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={cn("space-y-4", className)}>
      <span className="sr-only" role="status">
        {label}
      </span>

      <div aria-hidden="true" className="space-y-4">
        {variant === "table" ? <TableSkeleton rows={rows} /> : null}
        {variant === "cards" ? <CardsSkeleton rows={rows} /> : null}
        {variant === "form" ? <FormSkeleton /> : null}
      </div>
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted/40 p-3">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b p-3 last:border-b-0"
          >
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 lg:block" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </>
  );
}

function CardsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border bg-card p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
