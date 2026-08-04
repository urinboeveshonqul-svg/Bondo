"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeConfig, locales, type Locale } from "@/lib/site-config";

/**
 * Language switcher.
 *
 * Switches language *in place*: `usePathname` from `@/i18n/navigation` returns
 * the route without its locale prefix, so a Russian visitor reading a product
 * page lands on the same product page in Uzbek rather than being sent to the
 * home page. Losing someone's place is the thing that makes a language switcher
 * feel broken.
 *
 * The query string is read from `window.location` inside the handler rather
 * than with `useSearchParams`, deliberately. This component sits in the header,
 * which the root layout renders on every page including the statically
 * prerendered ones — and `useSearchParams` in a prerendered tree forces a
 * client-side bailout unless it is wrapped in `Suspense`, which would opt the
 * whole storefront out of static rendering to power one dropdown. Reading it on
 * click costs nothing and happens only in the browser, where it is available.
 *
 * The choice persists because navigating to the new prefix re-enters the
 * middleware, which writes `NEXT_LOCALE`. Nothing here touches the cookie
 * directly — one writer, and it is the same one that handles a first-time
 * visitor with no cookie at all.
 */
export function LanguageSwitcher() {
  const t = useTranslations("common.language");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;

    startTransition(() => {
      router.replace(`${pathname}${window.location.search}`, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("change")}
          disabled={isPending}
        >
          <Languages />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {locales.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => switchTo(option)}
            // The current language is announced rather than only ticked, so it
            // is not carried by the check glyph alone.
            aria-current={option === locale ? "true" : undefined}
            className="justify-between"
          >
            {/*
              `lang` on the item: these labels are each in their own language,
              so without it a screen reader reads "Русский" with Uzbek phonetics
              and "O'zbekcha" with Russian ones.
            */}
            <span lang={option}>{localeConfig[option].label}</span>
            {option === locale ? (
              <Check className="size-4" aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
