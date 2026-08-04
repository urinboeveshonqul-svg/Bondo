import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

/**
 * The frame every authentication page shares.
 *
 * One narrow column, centred, with the heading as the page's only `h1`. The
 * storefront's header and footer stay — these pages sit inside the same layout
 * as everything else, so a visitor who lands on sign-in from a search result can
 * still get back to the shop. Hiding the chrome is a habit borrowed from
 * single-purpose SaaS logins and it strands people.
 *
 * `footer` is the cross-link every one of these pages needs: sign-in points at
 * sign-up, sign-up points back, forgot-password points at both. Rendering it in
 * the shell keeps it in the same place with the same weight rather than each
 * page inventing its own.
 *
 * A Server Component. The forms inside are client islands; the frame is markup.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Container className={cn("flex justify-center py-12 sm:py-20", className)}>
      <div className="w-full max-w-md">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          {children}
        </div>

        {footer ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </div>
    </Container>
  );
}
