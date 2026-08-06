"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Package, Truck } from "lucide-react";

import { placeOrder } from "@/actions/orders.actions";
import { useCart } from "@/components/cart/cart-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/site-config";
import { formatPrice } from "@/utils/format";

type FieldErrors = Record<string, string[]>;

/**
 * Guest checkout.
 *
 * **No account required, and none offered here** (ADR-63). A shopper who has to
 * register before we ring them has already gone elsewhere; the invitation comes
 * after the order is safe, on the confirmation page.
 *
 * Every field maps to a column, and the two fulfilment paths ask for exactly one
 * different thing: a delivery needs an address, a pickup needs a shop. The
 * server enforces that too — `place_order` has a check constraint — so this is
 * the fast answer rather than the authority.
 *
 * Errors come back from `createAction` keyed by field path and are rendered
 * beside the input they belong to. The action returns **translation keys**, not
 * sentences, because a Server Action has no locale (see `auth.actions.ts`).
 */
export function CheckoutForm() {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { lines, ready, subtotalCents, clear } = useCart();

  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Resolves an action's key back into copy, falling back to the raw string. */
  const message = (key: string) => {
    try {
      return t(key.replace(/^checkout\./, ""));
    } catch {
      return key;
    }
  };

  const fieldError = (name: string) =>
    errors[name]?.[0] ? message(errors[name][0]) : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);

    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();

    startTransition(async () => {
      const result = await placeOrder({
        firstName: value("firstName"),
        lastName: value("lastName"),
        phone: value("phone"),
        phoneSecondary: value("phoneSecondary") || null,
        telegram: value("telegram") || null,
        email: value("email") || null,
        region: value("region"),
        city: value("city"),
        deliveryMethod: method,
        address: value("address"),
        pickupLocation: value("pickupLocation"),
        notes: value("notes") || null,
        locale,
        items: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
        })),
      });

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(message(result.error));
        return;
      }

      // Emptied only once the order exists. Clearing optimistically would lose a
      // basket to a validation failure, and rebuilding one from memory is the
      // most annoying way to lose a sale.
      clear();
      router.push(routes.checkoutSuccess(result.data.reference));
    });
  }

  // `ready` gates this so an empty state does not flash before localStorage has
  // been read on the first paint.
  if (ready && lines.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <Button asChild>
            <Link href={routes.catalog.index}>{tCommon("browseProducts")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <fieldset className="space-y-4">
          <legend className="mb-3 font-semibold tracking-tight">
            {t("sections.contact")}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="firstName"
              label={t("fields.firstName")}
              error={fieldError("firstName")}
              required
              autoComplete="given-name"
            />
            <Field
              name="lastName"
              label={t("fields.lastName")}
              error={fieldError("lastName")}
              required
              autoComplete="family-name"
            />
            <Field
              name="phone"
              label={t("fields.phone")}
              hint={t("fields.phoneHint")}
              error={fieldError("phone")}
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
            />
            <Field
              name="phoneSecondary"
              label={t("fields.phoneSecondary")}
              hint={t("fields.phoneSecondaryHint")}
              error={fieldError("phoneSecondary")}
              type="tel"
              inputMode="tel"
            />
            <Field
              name="telegram"
              label={t("fields.telegram")}
              hint={t("fields.telegramHint")}
              error={fieldError("telegram")}
              placeholder="@username"
            />
            <Field
              name="email"
              label={t("fields.email")}
              hint={t("fields.emailHint")}
              error={fieldError("email")}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-semibold tracking-tight">
            {t("sections.delivery")}
          </legend>

          {/*
            A radio group, not a select. Two options that change which field
            appears below should both be visible at once — a select hides the
            alternative behind a tap and makes the form feel like it changed
            shape on its own.
          */}
          <div
            role="radiogroup"
            aria-label={t("fields.deliveryMethod")}
            className="grid gap-3 sm:grid-cols-2"
          >
            {(
              [
                { value: "delivery", icon: Truck },
                { value: "pickup", icon: Package },
              ] as const
            ).map(({ value, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring",
                  method === value
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="sr-only"
                />
                <Icon
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    method === value ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {t(`deliveryMethods.${value}.label`)}
                  </span>
                  <span className="block text-xs text-pretty text-muted-foreground">
                    {t(`deliveryMethods.${value}.hint`)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="region"
              label={t("fields.region")}
              error={fieldError("region")}
              required
              autoComplete="address-level1"
            />
            <Field
              name="city"
              label={t("fields.city")}
              error={fieldError("city")}
              required
              autoComplete="address-level2"
            />
          </div>

          {method === "delivery" ? (
            <Field
              name="address"
              label={t("fields.address")}
              hint={t("fields.addressHint")}
              error={fieldError("address")}
              required
              autoComplete="street-address"
            />
          ) : (
            <Field
              name="pickupLocation"
              label={t("fields.pickupLocation")}
              hint={t("fields.pickupLocationHint")}
              error={fieldError("pickupLocation")}
              required
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("fields.notes")}</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
            <p className="text-xs text-muted-foreground">
              {t("fields.notesHint")}
            </p>
          </div>
        </fieldset>
      </div>

      {/* The summary sticks on desktop so the total stays visible while the form
          is filled in; on mobile it sits under the fields, where scrolling past
          it once is cheaper than pinning it over a small viewport. */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-semibold tracking-tight">
            {t("summary.title")}
          </h2>

          <ul className="mb-4 space-y-3">
            {lines.map((line) => (
              <li
                key={`${line.productId}:${line.variantId ?? ""}`}
                className="flex min-w-0 justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate">{line.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    × {line.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatPrice(line.unitPriceCents * line.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex justify-between border-t pt-3 text-sm">
            <span className="text-muted-foreground">{tCommon("subtotal")}</span>
            <span className="font-medium tabular-nums">
              {formatPrice(subtotalCents, locale)}
            </span>
          </div>

          <p className="mt-2 text-xs text-pretty text-muted-foreground">
            {t("summary.deliveryNote")}
          </p>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {t("submit")}
        </Button>

        <p className="text-xs text-pretty text-muted-foreground">
          {t("noPaymentNote")}
        </p>
      </aside>
    </form>
  );
}

/** One labelled input with its hint and error, so the markup is written once. */
function Field({
  name,
  label,
  hint,
  error,
  className,
  ...props
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
} & React.ComponentProps<typeof Input>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(" ") || undefined
        }
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
