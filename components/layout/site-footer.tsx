import { Container } from "@/components/layout/container";
import { siteConfig } from "@/lib/site-config";

/**
 * Footer placeholder.
 *
 * Link columns (shop, support, company, legal), payment badges and the
 * newsletter form are added in later phases once the pages they point at exist.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <Container className="flex flex-col gap-6 py-10">
        <div className="space-y-2">
          <p className="text-base font-semibold tracking-tight">
            {siteConfig.name}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {siteConfig.shortDescription}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
