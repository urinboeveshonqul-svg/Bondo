"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  Field,
  FormError,
  FormSuccess,
  PasswordField,
  SubmitButton,
  useAuthMessage,
} from "@/components/auth/form-primitives";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import {
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
} from "@/actions/auth.actions";

/**
 * The three single-purpose forms: request a reset, complete a reset, resend a
 * verification email. Grouped in one file because they are variations on the
 * same shape — one field or two, one action, one success state — and three
 * files of thirty lines each would hide that.
 */

/**
 * Forgot password.
 *
 * On success the form is **replaced** by the confirmation rather than showing a
 * message above a still-submittable form: the useful next step is the visitor's
 * inbox, not this page. The wording never confirms whether the address is
 * registered, matching what the action actually does.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tr = useAuthMessage();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");

    setFormError(undefined);

    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });

      if (!result.ok) {
        setFormError(tr(result.error));
        return;
      }

      setSentTo(email);
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <FormSuccess message={t("sent", { email: sentTo })} />
        <p className="text-sm text-muted-foreground">{t("sentHint")}</p>
      </div>
    );
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
        disabled={pending}
        required
      />

      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
    </form>
  );
}

/**
 * Reset password.
 *
 * Reached only after `/auth/callback` exchanged the emailed code for a real
 * session, so this is an authenticated password change and there is no token in
 * the form to forge. A visitor without that session gets `unauthorized` from the
 * action — which is what an expired or already-used link produces, and the
 * message says so rather than blaming the password.
 */
export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const tr = useAuthMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setFormError(undefined);
    setFieldErrors({});

    startTransition(async () => {
      const result = await resetPasswordAction({
        password: String(form.get("password") ?? ""),
        confirmPassword: String(form.get("confirmPassword") ?? ""),
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <FormSuccess message={t("done")} />
        {/* A link, not a button: it navigates, so it should be openable in a
            new tab and announced as a link. */}
        <Button asChild className="w-full">
          <Link href={routes.account.index}>{t("continue")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />

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

      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
    </form>
  );
}

/**
 * Resend a verification email.
 *
 * The address is pre-filled from the query string when the visitor arrived from
 * sign-up or a refused sign-in, and editable when they did not — somebody who
 * mistyped their address on registration has no other way to fix it, and
 * offering a read-only field would strand them.
 */
export function ResendVerificationForm({
  defaultEmail,
}: {
  defaultEmail?: string;
}) {
  const t = useTranslations("auth.verifyEmail");
  const tr = useAuthMessage();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setFormError(undefined);
    setSent(false);

    startTransition(async () => {
      const result = await resendVerificationAction({
        email: String(form.get("email") ?? ""),
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        return;
      }

      setSent(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      {sent ? <FormSuccess message={t("resent")} /> : null}

      <Field
        label={t("email")}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={defaultEmail}
        disabled={pending}
        required
      />

      <SubmitButton pending={pending}>{t("resend")}</SubmitButton>
    </form>
  );
}
