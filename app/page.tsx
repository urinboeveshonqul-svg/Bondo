import { Container } from "@/components/layout/container";
import { siteConfig } from "@/lib/site-config";

/**
 * Home page.
 *
 * A Server Component with no data dependencies, so it prerenders as static HTML
 * at build time. Merchandising sections (featured products, categories, deals)
 * arrive in a later phase and will stream in via `<Suspense>` so this shell
 * keeps rendering instantly.
 *
 * No links out yet — the routes in `lib/routes.ts` are declared but their pages
 * do not exist, and shipping a dead link is worse than shipping none.
 */
export default function HomePage() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {siteConfig.name}
      </h1>

      <p className="max-w-xl text-lg text-pretty text-muted-foreground">
        {siteConfig.description}
      </p>
    </Container>
  );
}
