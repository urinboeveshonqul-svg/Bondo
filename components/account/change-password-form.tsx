"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  FormError,
  FormSuccess,
  PasswordField,
  SubmitButton,
  useAuthMessage,
} from "@/components/auth/form-primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { changePasswordAction } from "@/actions/auth.actions";

/**
 * Change password, for a signed-in account.
 *
 * The current password is required. Supabase does not ask for it — `updateUser`
 * trusts the session — which means an unattended logged-in browser is enough to
 * change someone's password and lock them out of their own account. Asking is
 * what keeps a session compromise from becoming an account takeover.
 *
 * "Sign out everywhere" defaults to **on**, because the usual reason to change a
 * password is suspecting somebody else has it, and leaving their sessions alive
 * defeats the change. Ticking it ends this session too, so the form navigates to
 * sign-in rather than pretending the page is still usable.
 */
export function ChangePasswordForm() {
  const t = useTranslations("account.security");
  const tr = useAuthMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const everywhere = data.get("signOutEverywhere") === "on";

    setFormError(undefined);
    setFieldErrors({});
    setDone(false);

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword: String(data.get("currentPassword") ?? ""),
        password: String(data.get("password") ?? ""),
        confirmPassword: String(data.get("confirmPassword") ?? ""),
        signOutEverywhere: everywhere,
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      form.reset();
      setDone(true);

      if (result.data.signedOutEverywhere) {
        router.refresh();
        router.push(routes.auth.signIn);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />
      {done ? <FormSuccess message={t("passwordChanged")} /> : null}

      <PasswordField
        label={t("currentPassword")}
        name="currentPassword"
        autoComplete="current-password"
        error={tr(fieldErrors.currentPassword?.[0])}
        disabled={pending}
        required
      />

      <PasswordField
        label={t("newPassword")}
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

      <div className="flex items-start gap-2">
        <Checkbox
          id="signOutEverywhere"
          name="signOutEverywhere"
          defaultChecked
          disabled={pending}
          className="mt-0.5"
        />
        <Label htmlFor="signOutEverywhere" className="leading-snug font-normal">
          {t("signOutEverywhere")}
        </Label>
      </div>

      <SubmitButton pending={pending} className="sm:w-auto">
        {t("updatePassword")}
      </SubmitButton>
    </form>
  );
}
