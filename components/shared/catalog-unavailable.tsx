import { getTranslations } from "next-intl/server";
import { DatabaseZap } from "lucide-react";

import { Container } from "@/components/layout/container";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * What a storefront page renders when it cannot reach the catalog.
 *
 * It exists because the alternative was worse in both directions. Letting the
 * read throw replaced the whole document with `app/global-error.tsx` — no
 * header, no footer, no language, no way back — and putting a Suspense boundary
 * above the throw to get the route boundary instead made the page answer **200**
 * with an empty skeleton, which is a lie told to crawlers permanently.
 *
 * Three things it deliberately does **not** do:
 *
 *  * **It does not show fixtures.** A shop that renders yesterday's products
 *    while its database is down takes orders it cannot fulfil.
 *  * **It does not say "no products".** An empty catalog and an unreachable one
 *    are different facts, and only one of them is true here. The empty case has
 *    its own state, rendered by `ProductGrid`.
 *  * **It does not offer a retry button.** The visitor retrying changes nothing
 *    about a database being down; the browser's reload does the same thing
 *    without implying the store knows how to fix it.
 *
 * The failure itself is already in the server log with its stack and code, put
 * there by `readCatalog()`. This is what the visitor sees, not the diagnosis.
 */
export async function CatalogUnavailable() {
  const t = await getTranslations("errors.catalogUnavailable");

  return (
    <Container className="py-16 sm:py-24">
      <EmptyState
        icon={DatabaseZap}
        title={t("title")}
        description={t("description")}
      />
    </Container>
  );
}
