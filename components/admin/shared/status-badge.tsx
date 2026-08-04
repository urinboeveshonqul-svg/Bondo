import { cn } from "@/lib/utils";

/**
 * A status pill.
 *
 * Six tones, mapped to meaning rather than to colour names, so a caller asks for
 * "this is a warning" and cannot accidentally pick the discount orange —
 * reserved for price reductions across the whole design system (ADR-37).
 *
 * Every tone pairs a hue with a filled dot **and** a distinct word supplied by
 * the caller. Colour is never the only signal: a red/green deficiency or a
 * monochrome screen still reads the label.
 */
const TONES = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-foreground/20 bg-foreground/10 text-foreground",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-primary/30 bg-primary/10 text-primary",
  muted: "border-dashed border-border bg-transparent text-muted-foreground",
} as const;

export type StatusTone = keyof typeof TONES;

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {children}
    </span>
  );
}
