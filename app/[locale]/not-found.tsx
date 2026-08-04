import { useTranslations } from "next-intl";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

/**
 * Localized 404. Rendered for `notFound()` raised anywhere under `[locale]`,
 * including the `[...rest]` catch-all that turns an unmatched URL into one.
 *
 * There is no 404 above this. Middleware redirects every unprefixed path to a
 * locale, so an unmatched URL arrives here with its language already decided —
 * the difference between a lost visitor seeing "Bunday sahifa mavjud emas" and
 * seeing untranslated English at the exact moment they need help.
 */
export default function NotFound() {
  const t = useTranslations("errors.notFound");

  return (
    <Container className="flex flex-col items-start gap-6 py-24 sm:py-32">
      <p className="font-mono text-sm text-muted-foreground">{t("code")}</p>

      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {t("title")}
      </h1>

      <p className="max-w-md text-pretty text-muted-foreground">
        {t("description")}
      </p>

      <Button asChild>
        <Link href={routes.home}>{t("backHome")}</Link>
      </Button>
    </Container>
  );
}
