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
import { signInAction } from "@/actions/auth.actions";

/**
 * Sign in.
 *
 * ## Remember me
 *
 * It pre-fills the address next time and nothing else. Supabase's session
 * lifetime is a **project** setting, not a per-request one, so a checkbox
 * claiming to shorten this session would be decoration. Storing the address in
 * `localStorage` is what the control can honestly deliver, and the label says
 * exactly that (**D-22**). The password is never stored.
 *
 * ## Unverified accounts
 *
 * Supabase refuses the sign-in itself when confirmation is required, so this
 * form does not decide the policy — it recognises the failure and sends the
 * visitor somewhere useful instead of leaving them on a form that will keep
 * saying no.
 *
 * `router.refresh()` before navigating: the session cookie was set by the
 * action's response, and without a refresh the header still renders the
 * signed-out state on the page we land on.
 */
const REMEMBERED_EMAIL = "bondo.rememberedEmail";

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("auth.signIn");
  const tr = useAuthMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const remembered =
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(REMEMBERED_EMAIL) ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const rememberMe = form.get("rememberMe") === "on";

    setFormError(undefined);
    setFieldErrors({});

    startTransition(async () => {
      const result = await signInAction({
        email,
        password: String(form.get("password") ?? ""),
        rememberMe,
        redirectTo,
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        setFieldErrors(result.fieldErrors ?? {});

        // The one failure with somewhere better to be than this form.
        if (result.error === "errors.emailNotVerified") {
          router.push(
            `${routes.auth.verifyEmail}?email=${encodeURIComponent(email)}`,
          );
        }
        return;
      }

      if (rememberMe) window.localStorage.setItem(REMEMBERED_EMAIL, email);
      else window.localStorage.removeItem(REMEMBERED_EMAIL);

      router.refresh();
      router.push(result.data.redirectTo);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

      <Field
        label={t("email")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={remembered}
        error={tr(fieldErrors.email?.[0])}
        disabled={pending}
        required
      />

      <div className="space-y-1.5">
        <PasswordField
          label={t("password")}
          name="password"
          autoComplete="current-password"
          error={tr(fieldErrors.password?.[0])}
          disabled={pending}
          required
        />
        <p className="text-end">
          <Link
            href={routes.auth.forgotPassword}
            className="rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {t("forgot")}
          </Link>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="rememberMe"
          name="rememberMe"
          defaultChecked={remembered !== ""}
          disabled={pending}
        />
        <Label htmlFor="rememberMe" className="font-normal">
          {t("rememberMe")}
        </Label>
      </div>

      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
    </form>
  );
}
