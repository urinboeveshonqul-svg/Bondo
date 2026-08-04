"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Check, Eye, EyeOff, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_RULES,
  passwordRulesMet,
  passwordScore,
} from "@/lib/auth/password";
import { cn } from "@/lib/utils";

/**
 * The controls every authentication form is built from.
 *
 * They exist so the five forms cannot drift: one error presentation, one busy
 * state, one way a field announces that it is invalid. A form that renders its
 * own red text is a form whose error is invisible to a screen reader, and that
 * is exactly the kind of difference nobody notices in review.
 *
 * ## Errors are translation keys
 *
 * Server Actions return keys, not sentences (see `actions/auth.actions.ts`), so
 * every component here resolves them through the `auth` namespace. `tr()` falls
 * back to the raw value when it is not a known key, which keeps an unexpected
 * upstream string readable instead of rendering the word "undefined".
 */

/** Resolves a key from the `auth` namespace, falling back to the raw string. */
export function useAuthMessage() {
  const t = useTranslations("auth");

  return (key: string | undefined): string | undefined => {
    if (!key) return undefined;

    try {
      const value = t(key);
      // next-intl echoes the path back when a key is missing.
      return value === key || value.endsWith(`.${key}`) ? key : value;
    } catch {
      return key;
    }
  };
}

/**
 * A labelled text input with its error.
 *
 * `aria-invalid` and `aria-describedby` are wired together here rather than left
 * to each form: a message that is visually beside a field but not associated
 * with it is a message a screen reader user never hears.
 */
export function Field({
  label,
  name,
  type = "text",
  error,
  hint,
  autoComplete,
  defaultValue,
  required,
  disabled,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputMode?: "email" | "text" | "tel";
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
      />

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A password input with a reveal toggle and, optionally, a strength meter.
 *
 * The toggle is a real button with a changing accessible name, not an icon that
 * silently swaps. The meter reads the **same** `lib/auth/password` rules the Zod
 * schema does, so it cannot call a password acceptable that the action then
 * rejects.
 */
export function PasswordField({
  label,
  name,
  error,
  autoComplete = "current-password",
  required,
  disabled,
  showMeter = false,
}: {
  label: string;
  name: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  showMeter?: boolean;
}) {
  const t = useTranslations("auth.password");
  const id = useId();
  const errorId = `${id}-error`;
  const meterId = `${id}-meter`;

  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");

  const score = passwordScore(value);
  const met = passwordRulesMet(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            cn(error && errorId, showMeter && meterId) || undefined
          }
          className="pe-10"
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute end-0 top-0 grid h-9 w-10 place-items-center rounded-e-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          <span className="sr-only">{visible ? t("hide") : t("show")}</span>
        </button>
      </div>

      {showMeter ? (
        <div id={meterId} className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <div
              className="flex h-1 flex-1 gap-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={score}
              aria-label={t("strength")}
            >
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    "h-full flex-1 rounded-full transition-colors",
                    index < score
                      ? score <= 1
                        ? "bg-destructive"
                        : score === 2
                          ? "bg-foreground/40"
                          : "bg-success"
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t(`levels.${Math.max(score, 0)}`)}
            </span>
          </div>

          {/* The rules, each with its own state. A list of requirements that
              does not say which one is unmet is a list nobody can act on. */}
          <ul className="grid gap-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => (
              <li
                key={rule}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  met[rule] ? "text-success" : "text-muted-foreground",
                )}
              >
                {met[rule] ? (
                  <Check className="size-3 shrink-0" aria-hidden="true" />
                ) : (
                  <X className="size-3 shrink-0" aria-hidden="true" />
                )}
                {t(`rules.${rule}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The form-level failure banner.
 *
 * `role="alert"` so it is announced when it appears — a message that only
 * changes colour is a message a blind user submits into repeatedly.
 */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** The success counterpart, for "check your inbox" and "password changed". */
export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
    >
      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/**
 * The submit button, with its pending state.
 *
 * Disabled *and* labelled while working: a spinner alone leaves a screen reader
 * on "Sign in" with no indication anything happened, and an enabled button
 * invites a second submit that creates a second account.
 */
export function SubmitButton({
  children,
  pending,
  className,
}: {
  children: React.ReactNode;
  pending: boolean;
  className?: string;
}) {
  const t = useTranslations("auth");

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn("w-full", className)}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          {t("working")}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
