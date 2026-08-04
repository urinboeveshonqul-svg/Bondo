import { cn } from "@/lib/utils";

/**
 * A titled block within a form.
 *
 * A product editor with twenty fields in one column is unreadable; the same
 * twenty grouped under Basics / Pricing / Publishing is scannable. The heading
 * is a real `h2` tied to the `section` with `aria-labelledby`, so the groups are
 * navigable by heading rather than being visual-only.
 */
export function FormSection({
  id,
  title,
  description,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  /** Secondary control shown beside the heading, e.g. a status toggle. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `form-section-${id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {aside}
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Two fields side by side on desktop, stacked below `sm`. */
export function FormRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>
  );
}
