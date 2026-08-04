"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  Field,
  FormError,
  PasswordField,
  SubmitButton,
  useAuthMessage,
} from "@/components/auth/form-primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { signUpAction } from "@/actions/auth.actions";

/**
 * Registration.
 *
 * The profile and the default wishlist are created by a database trigger inside
 * the signup transaction (ADR-59), so there is nothing to do after this returns
 * but send the visitor to check their inbox. That is the whole point of putting
 * it in the trigger: this form cannot leave an account half-made by failing
 * between two calls.
 *
 * ## Terms
 *
 * A real checkbox that must be ticked, validated server-side as `literal(true)`.
 * The client sends an actual boolean rather than the browser's `"on"`, so a
 * hand-rolled POST cannot satisfy it with any truthy string.
 *
 * ## Where it goes next
 *
 * Always `/verify-email`, even on a project configured not to require
 * confirmation — in that case the account is already usable and the page says
 * so, with a link onward. Branching on `hasSession` here would put the
 * "confirmation required" decision in the browser, where it does not belong.
 */
export function SignUpForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("auth.signUp");
  const tr = useAuthMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    setFormError(undefined);
    setFieldErrors({});

    startTransition(async () => {
      const result = await signUpAction({
        fullName: String(form.get("fullName") ?? ""),
        email,
        password: String(form.get("password") ?? ""),
        confirmPassword: String(form.get("confirmPassword") ?? ""),
        acceptTerms: form.get("acceptTerms") === "on",
        redirectTo,
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.push(
        `${routes.auth.verifyEmail}?email=${encodeURIComponent(email)}&sent=1`,
      );
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <Field
        label={t("fullName")}
        name="fullName"
        autoComplete="name"
        error={tr(fieldErrors.fullName?.[0])}
        disabled={pending}
        required
      />

      <Field
        label={t("email")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        error={tr(fieldErrors.email?.[0])}
        disabled={pending}
        required
      />

      <PasswordField
        label={t("password")}
        name="password"
        autoComplete="new-password"
        error={tr(fieldErrors.password?.[0])}
        disabled={pending}
        showMeter
        required
      />

      <PasswordField
        label={t("confirmPassword")}
        name="confirmPassword"
        autoComplete="new-password"
        error={tr(fieldErrors.confirmPassword?.[0])}
        disabled={pending}
        required
      />

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            disabled={pending}
            aria-invalid={fieldErrors.acceptTerms ? true : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="acceptTerms" className="leading-snug font-normal">
            {t.rich("terms", {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>

        {fieldErrors.acceptTerms ? (
          <p className="text-xs font-medium text-destructive">
            {tr(fieldErrors.acceptTerms[0])}
          </p>
        ) : null}
      </div>

      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
    </form>
  );
}
