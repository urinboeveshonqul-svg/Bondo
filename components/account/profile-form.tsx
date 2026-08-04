"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  useAuthMessage,
} from "@/components/auth/form-primitives";
import { useRouter } from "@/i18n/navigation";
import { updateProfileAction } from "@/actions/auth.actions";

/**
 * Edit the signed-in user's own profile.
 *
 * The email address is shown by the page but is **not** editable here. Changing
 * it in Supabase re-runs verification and can leave an account addressable by
 * neither the old nor the new address until a link is clicked; that deserves its
 * own flow with its own explanation, not a text input beside a name (**D-23**).
 *
 * The user id is never in this form. The action takes it from the validated
 * session — see the note there on why an endpoint whose safety rests entirely on
 * RLS is one migration away from being an authorisation bug.
 */
export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const t = useTranslations("account.profile");
  const tr = useAuthMessage();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setFormError(undefined);
    setFieldErrors({});
    setSaved(false);

    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: String(form.get("fullName") ?? ""),
        phone: String(form.get("phone") ?? ""),
      });

      if (!result.ok) {
        setFormError(tr(result.error));
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setSaved(true);
      // The name is rendered by the account overview and the header, both
      // Server Components, so the new value only appears after a refresh.
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormError message={formError} />
      {saved ? <FormSuccess message={t("saved")} /> : null}

      <Field
        label={t("fullName")}
        name="fullName"
        autoComplete="name"
        defaultValue={fullName}
        error={tr(fieldErrors.fullName?.[0])}
        disabled={pending}
        required
      />

      <Field
        label={t("phone")}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        defaultValue={phone}
        hint={t("phoneHint")}
        error={tr(fieldErrors.phone?.[0])}
        disabled={pending}
      />

      <SubmitButton pending={pending} className="sm:w-auto">
        {t("save")}
      </SubmitButton>
    </form>
  );
}
