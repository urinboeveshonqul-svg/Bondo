import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 44px on touch, 32px from `lg`.
 *
 * Every form on the site is filled in on a phone more often than on a desktop,
 * and 32px is below the WCAG 2.2 SC 2.5.8 floor for a target a thumb aims at.
 * The `text-base` already here matters for the same reason: iOS Safari zooms
 * the page when a focused field's text is under 16px, which on a sign-in form
 * reads as the layout breaking.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm lg:h-8 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
