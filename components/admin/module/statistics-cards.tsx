import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The headline figures at the top of a module.
 *
 * `StatisticsCards` is the grid; `StatCard` is one figure. They are separate
 * because the grid is the part that has to be identical — four across on a wide
 * screen, two on a tablet, one on a phone — and a module that lays out its own
 * row of cards is a module whose fifth card wraps into a lonely second line.
 *
 * The count drives the columns rather than a fixed `grid-cols-4`, so three cards
 * fill the width instead of leaving a hole where the fourth would be.
 */
export function StatisticsCards({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A single headline figure.
 *
 * The delta is rendered as a signed percentage with an arrow **and** a word in
 * the accessible name, because an arrow alone is meaningless to a screen reader
 * and a colour alone is meaningless to a third of colour-deficient readers.
 *
 * Green for up and red for down is deliberately **not** applied to every metric:
 * a rise in "out of stock" is bad news. Callers pass `invertTrend` for those, so
 * the colour tracks whether the change is good rather than whether the number
 * went up.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  deltaPercent,
  deltaLabel,
  invertTrend = false,
  footnote,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  /** `null` when there is no comparable previous period. */
  deltaPercent?: number | null;
  /** Already-formatted, e.g. "vs previous 30 days". */
  deltaLabel?: string;
  invertTrend?: boolean;
  footnote?: string;
  className?: string;
}) {
  const hasDelta = deltaPercent !== null && deltaPercent !== undefined;
  const isUp = hasDelta && deltaPercent > 0;
  const isGood = invertTrend ? !isUp : isUp;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>

      <p className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>

      {hasDelta && deltaPercent !== 0 ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium tabular-nums",
              isGood ? "text-success" : "text-destructive",
            )}
          >
            {isUp ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {`${isUp ? "+" : ""}${deltaPercent.toFixed(1)}%`}
          </span>
          {deltaLabel ? (
            <span className="text-muted-foreground">{deltaLabel}</span>
          ) : null}
        </p>
      ) : footnote ? (
        <p className="text-xs text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}
