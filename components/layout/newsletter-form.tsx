"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Newsletter signup.
 *
 * Validation is `type="email"` plus `required`, so the browser's own message
 * appears in the visitor's language and is announced without extra work. That
 * is a real reason to prefer native validation over a hand-rolled message: the
 * browser already ships all three translations and keeps them in step with the
 * user's OS locale, which a bespoke string never would.
 *
 * There is no subscribe endpoint yet. Rather than fake a success toast — which
 * would teach the shopper they are subscribed when nothing recorded it — the
 * form reports honestly that signup opens later and does not clear the field.
 * The Server Action replaces this handler when the mailing service is chosen;
 * the markup does not change.
 */
export function NewsletterForm({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("newsletter");
  const [email, setEmail] = useState("");

  return (
    <form
      className={cn(
        "flex w-full gap-2",
        compact ? "flex-col" : "flex-col sm:flex-row",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        toast(t("toastTitle"), { description: t("toastDescription") });
      }}
    >
      <label
        htmlFor={compact ? "newsletter-compact" : "newsletter"}
        className="sr-only"
      >
        {t("emailLabel")}
      </label>
      <Input
        id={compact ? "newsletter-compact" : "newsletter"}
        type="email"
        required
        autoComplete="email"
        placeholder={t("placeholder")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={compact ? undefined : "sm:max-w-xs"}
      />
      <Button type="submit" size={compact ? "sm" : "default"}>
        {t("subscribe")}
      </Button>
    </form>
  );
}
