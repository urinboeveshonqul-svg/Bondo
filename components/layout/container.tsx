import { cn } from "@/lib/utils";

/**
 * The single horizontal rhythm for the site. Every full-width section wraps its
 * content in one of these so page gutters stay consistent.
 */
export function Container({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
