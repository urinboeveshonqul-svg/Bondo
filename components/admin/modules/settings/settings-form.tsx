"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImageOff, Save } from "lucide-react";

import {
  ModuleFormRow,
  ModuleFormSection,
} from "@/components/admin/module/module-form";
import { ModuleTabs } from "@/components/admin/module/module-tabs";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ModuleCapabilities } from "@/lib/admin/module";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/admin/settings-sections";
import type { StoreSettings } from "@/types/admin";

/**
 * Store settings.
 *
 * `public.settings` is a key/value table grouped by prefix, so the tabs here are
 * the prefixes rather than an invented taxonomy — `store.*`, `commerce.*`,
 * `email.*`. Saving becomes one upsert per changed key.
 *
 * Localized where the value is copy a customer reads (tagline, address) and
 * plain where it is configuration (currency code, tax rate, sender address).
 * Getting that split wrong in either direction is the mistake: a translated
 * currency code is nonsense, and an English-only tagline appears on the Russian
 * storefront.
 */
export function SettingsForm({
  settings,
  capabilities,
}: {
  settings: StoreSettings;
  capabilities: ModuleCapabilities;
}) {
  const canUpdate = capabilities.update;
  const t = useTranslations("adminSystem.settings");
  const tAdmin = useTranslations("admin");
  const [draft, setDraft] = useState<StoreSettings>(settings);

  function notSaved() {
    toast(tAdmin("notSaved.title"), { description: tAdmin("notSaved.body") });
  }

  const disabled = !canUpdate;

  /**
   * One panel per registry entry. The strip, its order and its labels come
   * from `SETTINGS_SECTIONS`; this object only says what goes inside each one,
   * so adding a section cannot mean forgetting to add its tab.
   */
  const panels: Record<SettingsSectionId, React.ReactNode> = {
    store: (
      <ModuleFormSection
        id="store"
        title={t("store.title")}
        description={t("store.description")}
      >
        <div className="space-y-1.5">
          <Label htmlFor="store-name">{t("store.name")}</Label>
          <Input
            id="store-name"
            value={draft.store.name}
            disabled={disabled}
            onChange={(event) =>
              setDraft({
                ...draft,
                store: { ...draft.store, name: event.target.value },
              })
            }
          />
          <p className="text-xs text-muted-foreground">{t("store.nameHint")}</p>
        </div>

        <LocalizedField
          label={t("store.tagline")}
          value={draft.store.tagline}
          disabled={disabled}
          onChange={(tagline) =>
            setDraft({ ...draft, store: { ...draft.store, tagline } })
          }
        />

        <ModuleFormRow>
          <div className="space-y-1.5">
            <Label htmlFor="store-email">{t("store.supportEmail")}</Label>
            <Input
              id="store-email"
              type="email"
              value={draft.store.supportEmail}
              disabled={disabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  store: {
                    ...draft.store,
                    supportEmail: event.target.value,
                  },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-phone">{t("store.supportPhone")}</Label>
            <Input
              id="store-phone"
              type="tel"
              value={draft.store.supportPhone}
              disabled={disabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  store: {
                    ...draft.store,
                    supportPhone: event.target.value,
                  },
                })
              }
            />
          </div>
        </ModuleFormRow>

        <LocalizedField
          label={t("store.address")}
          value={draft.store.addressLine}
          disabled={disabled}
          onChange={(addressLine) =>
            setDraft({ ...draft, store: { ...draft.store, addressLine } })
          }
        />
      </ModuleFormSection>
    ),
    commerce: (
      <ModuleFormSection
        id="commerce"
        title={t("commerce.title")}
        description={t("commerce.description")}
      >
        <ModuleFormRow>
          <div className="space-y-1.5">
            <Label htmlFor="commerce-currency">{t("commerce.currency")}</Label>
            <Input
              id="commerce-currency"
              value={draft.commerce.currency}
              maxLength={3}
              disabled={disabled}
              className="font-mono uppercase"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  commerce: {
                    ...draft.commerce,
                    currency: event.target.value.toUpperCase(),
                  },
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("commerce.currencyHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commerce-tax">{t("commerce.taxRate")}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="commerce-tax"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={draft.commerce.taxRatePercent}
                disabled={disabled}
                className="tabular-nums"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    commerce: {
                      ...draft.commerce,
                      taxRatePercent: Number(event.target.value) || 0,
                    },
                  })
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </ModuleFormRow>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="commerce-inclusive" className="font-normal">
            {t("commerce.taxInclusive")}
          </Label>
          <Switch
            id="commerce-inclusive"
            checked={draft.commerce.taxInclusivePricing}
            disabled={disabled}
            onCheckedChange={(taxInclusivePricing) =>
              setDraft({
                ...draft,
                commerce: { ...draft.commerce, taxInclusivePricing },
              })
            }
          />
        </div>

        <ModuleFormRow>
          <MoneyField
            id="commerce-free-delivery"
            label={t("commerce.freeDelivery")}
            cents={draft.commerce.freeDeliveryThresholdCents}
            disabled={disabled}
            onChange={(freeDeliveryThresholdCents) =>
              setDraft({
                ...draft,
                commerce: { ...draft.commerce, freeDeliveryThresholdCents },
              })
            }
          />
          <MoneyField
            id="commerce-flat-fee"
            label={t("commerce.flatFee")}
            cents={draft.commerce.flatDeliveryFeeCents}
            disabled={disabled}
            onChange={(flatDeliveryFeeCents) =>
              setDraft({
                ...draft,
                commerce: { ...draft.commerce, flatDeliveryFeeCents },
              })
            }
          />
        </ModuleFormRow>

        <p className="text-xs text-muted-foreground">
          {t("commerce.shippingNote")}
        </p>
      </ModuleFormSection>
    ),
    email: (
      <ModuleFormSection
        id="email"
        title={t("email.title")}
        description={t("email.description")}
      >
        <ModuleFormRow>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-name">{t("email.senderName")}</Label>
            <Input
              id="email-sender-name"
              value={draft.email.senderName}
              disabled={disabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  email: { ...draft.email, senderName: event.target.value },
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-address">
              {t("email.senderAddress")}
            </Label>
            <Input
              id="email-sender-address"
              type="email"
              value={draft.email.senderAddress}
              disabled={disabled}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  email: {
                    ...draft.email,
                    senderAddress: event.target.value,
                  },
                })
              }
            />
          </div>
        </ModuleFormRow>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="email-low-stock" className="font-normal">
            {t("email.lowStockAlerts")}
          </Label>
          <Switch
            id="email-low-stock"
            checked={draft.email.lowStockAlerts}
            disabled={disabled}
            onCheckedChange={(lowStockAlerts) =>
              setDraft({
                ...draft,
                email: { ...draft.email, lowStockAlerts },
              })
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="email-orders" className="font-normal">
            {t("email.orderNotifications")}
          </Label>
          <Switch
            id="email-orders"
            checked={draft.email.orderNotifications}
            disabled={disabled}
            onCheckedChange={(orderNotifications) =>
              setDraft({
                ...draft,
                email: { ...draft.email, orderNotifications },
              })
            }
          />
        </div>

        <p className="text-xs text-muted-foreground">{t("email.notWired")}</p>
      </ModuleFormSection>
    ),
    social: (
      <ModuleFormSection
        id="social"
        title={t("social.title")}
        description={t("social.description")}
      >
        <ModuleFormRow>
          {(["x", "youtube", "linkedin", "github"] as const).map((channel) => (
            <div key={channel} className="space-y-1.5">
              <Label htmlFor={`social-${channel}`}>
                {t(`social.${channel}`)}
              </Label>
              <Input
                id={`social-${channel}`}
                type="url"
                value={draft.social[channel]}
                disabled={disabled}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    social: {
                      ...draft.social,
                      [channel]: event.target.value,
                    },
                  })
                }
              />
            </div>
          ))}
        </ModuleFormRow>
      </ModuleFormSection>
    ),
    branding: (
      <ModuleFormSection
        id="branding"
        title={t("branding.title")}
        description={t("branding.description")}
      >
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <ImageOff
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium">{t("branding.noLogo")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("branding.uploadsUnavailable")}
          </p>
        </div>
      </ModuleFormSection>
    ),
    hours: (
      <ModuleFormSection
        id="hours"
        title={t("hours.title")}
        description={t("hours.description")}
      >
        <ul className="space-y-2">
          {draft.businessHours.map((day) => (
            <li
              key={day.day}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
            >
              <span className="text-sm font-medium">
                {t(`hours.days.${day.day}`)}
              </span>

              {day.opens === null ? (
                <span className="text-sm text-muted-foreground sm:col-span-3 sm:text-end">
                  {t("hours.closed")}
                </span>
              ) : (
                <>
                  <Input
                    type="time"
                    value={day.opens}
                    disabled={disabled}
                    aria-label={`${t("hours.opens")} — ${t(`hours.days.${day.day}`)}`}
                    className="w-32"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        businessHours: draft.businessHours.map((current) =>
                          current.day === day.day
                            ? { ...current, opens: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                  <span aria-hidden="true" className="text-muted-foreground">
                    –
                  </span>
                  <Input
                    type="time"
                    value={day.closes ?? ""}
                    disabled={disabled}
                    aria-label={`${t("hours.closes")} — ${t(`hours.days.${day.day}`)}`}
                    className="w-32"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        businessHours: draft.businessHours.map((current) =>
                          current.day === day.day
                            ? { ...current, closes: event.target.value }
                            : current,
                        ),
                      })
                    }
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </ModuleFormSection>
    ),
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        notSaved();
      }}
    >
      <ModuleTabs
        tabs={SETTINGS_SECTIONS.map((section) => ({
          id: section.id,
          label: t(`tabs.${section.labelKey}`),
          content: panels[section.id],
        }))}
      />

      {canUpdate ? (
        <Button type="submit">
          <Save aria-hidden="true" />
          {tAdmin("actions.saveChanges")}
        </Button>
      ) : null}
    </form>
  );
}

function MoneyField({
  id,
  label,
  cents,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  cents: number;
  onChange: (cents: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        value={(cents / 100).toFixed(2)}
        disabled={disabled}
        className="tabular-nums"
        onChange={(event) =>
          onChange(Math.round(Number(event.target.value) * 100) || 0)
        }
      />
    </div>
  );
}
