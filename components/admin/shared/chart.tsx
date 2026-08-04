import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/types/admin";

/**
 * Charts, drawn as plain SVG.
 *
 * No charting library. Recharts and its peers are client-only and cost 40–90 kB
 * for what is, here, a polyline and some rectangles — and they would make the
 * dashboard a Client Component for the sake of two static pictures. These render
 * on the server and ship as markup.
 *
 * Accessibility is the part a hand-rolled chart usually gets wrong, so both
 * carry `role="img"` with a summarising label **and** a visually hidden table
 * of the underlying figures. A screen reader gets the numbers, not "graphic".
 *
 * The viewBox is fixed and the element scales, so the chart is responsive
 * without measuring anything on the client.
 */

const WIDTH = 600;
const HEIGHT = 180;
const PADDING = { top: 8, right: 4, bottom: 4, left: 4 };

function DataTableFallback({
  points,
  labelHeader,
  valueHeader,
  format,
}: {
  points: readonly SeriesPoint[];
  labelHeader: string;
  valueHeader: string;
  format: (value: number) => string;
}) {
  return (
    <table className="sr-only">
      <caption>{valueHeader}</caption>
      <thead>
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.date}>
            <th scope="row">{point.date}</th>
            <td>{format(point.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Area chart with a highlighted trend line. */
export function LineChart({
  points,
  label,
  dateHeader,
  valueHeader,
  format,
  className,
}: {
  points: readonly SeriesPoint[];
  /** Accessible summary, e.g. "Revenue, last 30 days". */
  label: string;
  dateHeader: string;
  valueHeader: string;
  format: (value: number) => string;
  className?: string;
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  // Floor at zero rather than at the minimum: a revenue chart whose baseline is
  // the worst day exaggerates every wobble into a cliff.
  const min = 0;
  const span = max - min || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const coords = points.map((point, index) => {
    const x = PADDING.left + (index / (points.length - 1)) * plotWidth;
    const y =
      PADDING.top + plotHeight - ((point.value - min) / span) * plotHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = coords.join(" ");
  const area = `${PADDING.left},${HEIGHT - PADDING.bottom} ${line} ${WIDTH - PADDING.right},${HEIGHT - PADDING.bottom}`;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="h-40 w-full overflow-visible"
      >
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity="0.18"
              className="text-primary"
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity="0"
              className="text-primary"
            />
          </linearGradient>
        </defs>

        <polygon points={area} fill="url(#chart-area)" />
        <polyline
          points={line}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-primary"
        />
      </svg>

      <DataTableFallback
        points={points}
        labelHeader={dateHeader}
        valueHeader={valueHeader}
        format={format}
      />
    </div>
  );
}

/** Vertical bars, one per point. */
export function BarChart({
  points,
  label,
  dateHeader,
  valueHeader,
  format,
  className,
}: {
  points: readonly SeriesPoint[];
  label: string;
  dateHeader: string;
  valueHeader: string;
  format: (value: number) => string;
  className?: string;
}) {
  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.value)) || 1;
  const slot = WIDTH / points.length;
  // A one-unit gutter each side, so bars read as separate at any width.
  const barWidth = Math.max(2, slot - 2);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
        className="h-40 w-full"
      >
        {points.map((point, index) => {
          const height = Math.max(2, (point.value / max) * (HEIGHT - 8));

          return (
            <rect
              key={point.date}
              x={index * slot + 1}
              y={HEIGHT - height}
              width={barWidth}
              height={height}
              rx="2"
              className="fill-primary/70"
            />
          );
        })}
      </svg>

      <DataTableFallback
        points={points}
        labelHeader={dateHeader}
        valueHeader={valueHeader}
        format={format}
      />
    </div>
  );
}
