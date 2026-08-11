"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { saveSettings } from "@/actions/settings.actions";
import {
  ModuleFormRow,
  ModuleFormSection,
} from "@/components/admin/module/module-form";
import { ModuleTabs } from "@/components/admin/module/module-tabs";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { PlannedSection } from "@/components/admin/modules/settings/planned-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/admin/settings-sections";
import type { ModuleCapabilities } from "@/lib/admin/module";
import type { LocalizedText } from "@/types/catalog";
import type { EditableSettings } from "@/types/admin";

/**
 * Store settings.
 *
 * ## What changed, and why it is smaller than it was
 *
 * This form used to render seven tabs of fields over a `storeSettings` fixture
 * and call `notSaved()` on submit — a tax rate, sender addresses, four social
 * URLs and a per-day opening-hours grid, none of which had a row in `settings`
 * and every one of which discarded what an operator typed into it.
 *
 * It now edits the keys the table actually holds, and each one has a reader:
 * `getStoreContact()` renders the contact page from `store.*`, and the catalog
 * takes its page size from `catalog.*`. The tabs that had nothing behind them
 * are `planned` in the registry, which states the gap instead of faking it.
 *
 * ## Localized where a customer reads it
 *
 * `store.address` and `store.hours` are prose and go to `setting_translations`,
 * one row per language. A phone number is not prose — it is the same digits in
 * all three, and a translated one is a wrong number.
 */
export function SettingsForm({
  settings,
  capabilities,
}: {
  settings: EditableSettings;
  capabilities: ModuleCapabilities;
}) {
  const t = useTranslations("adminSystem.settings");
  const tAdmin = useTranslations("admin");
  const [draft, setDraft] = useState<EditableSettings>(settings);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canUpdate = capabilities.update;
  const disabled = !canUpdate || pending;

  const setPlain = (key: keyof EditableSettings["plain"], value: string) =>
    setDraft((current) => ({
      ...current,
      plain: { ...current.plain, [key]: value },
    }));

  const setNumeric = (key: keyof EditableSettings["numeric"], value: number) =>
    setDraft((current) => ({
      ...current,
      numeric: { ...current.numeric, [key]: value },
    }));

  const setLocalized = (
    key: keyof EditableSettings["localized"],
    value: LocalizedText,
  ) =>
    setDraft((current) => ({
      ...current,
      localized: { ...current.localized, [key]: value },
    }));

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canUpdate) return;

    startTransition(async () => {
      const result = await saveSettings({
        plain: draft.plain,
        numeric: draft.numeric,
        localized: draft.localized,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      // Re-reads the row that was just written, so the form shows what the
      // database now holds rather than what was typed at it.
      router.refresh();
    });
  }

  const panels: Record<SettingsSectionId, React.ReactNode> = {
    ...(Object.fromEntries(
      SETTINGS_SECTIONS.filter((section) => section.status === "planned").map(
        (section) => [
          section.id,
          <PlannedSection
            key={section.id}
            id={section.id}
            blockedBy={"blockedBy" in section ? section.blockedBy : undefined}
          />,
        ],
      ),
    ) as Record<SettingsSectionId, React.ReactNode>),

    store: (
      <ModuleFormSection
        id="store"
        title={t("store.title")}
        description={t("store.description")}
      >
        <TextField
          id="store-name"
          label={t("store.name")}
          hint={t("store.nameHint")}
          value={draft.plain["store.name"]}
          disabled={disabled}
          onChange={(value) => setPlain("store.name", value)}
        />

        <ModuleFormRow>
          <TextField
            id="store-email"
            type="email"
            label={t("store.supportEmail")}
            value={draft.plain["store.support_email"]}
            disabled={disabled}
            onChange={(value) => setPlain("store.support_email", value)}
          />
          <TextField
            id="store-phone"
            type="tel"
            label={t("store.supportPhone")}
            hint={t("store.phoneHint")}
            value={draft.plain["store.phone"]}
            disabled={disabled}
            onChange={(value) => setPlain("store.phone", value)}
          />
        </ModuleFormRow>

        <TextField
          id="store-telegram"
          label={t("store.telegram")}
          value={draft.plain["store.telegram"]}
          disabled={disabled}
          onChange={(value) => setPlain("store.telegram", value)}
        />

        <LocalizedField
          label={t("store.address")}
          hint={t("store.addressHint")}
          value={draft.localized["store.address"]}
          disabled={disabled}
          onChange={(value) => setLocalized("store.address", value)}
        />

        <LocalizedField
          label={t("store.hours")}
          hint={t("store.hoursHint")}
          value={draft.localized["store.hours"]}
          disabled={disabled}
          onChange={(value) => setLocalized("store.hours", value)}
        />
      </ModuleFormSection>
    ),

    catalog: (
      <ModuleFormSection
        id="catalog"
        title={t("catalog.title")}
        description={t("catalog.description")}
      >
        <ModuleFormRow>
          <NumberField
            id="catalog-per-page"
            label={t("catalog.productsPerPage")}
            hint={t("catalog.productsPerPageHint")}
            value={draft.numeric["catalog.products_per_page"]}
            disabled={disabled}
            onChange={(value) => setNumeric("catalog.products_per_page", value)}
          />
          <NumberField
            id="catalog-max-per-page"
            label={t("catalog.maxProductsPerPage")}
            hint={t("catalog.maxProductsPerPageHint")}
            value={draft.numeric["catalog.max_products_per_page"]}
            disabled={disabled}
            onChange={(value) =>
              setNumeric("catalog.max_products_per_page", value)
            }
          />
        </ModuleFormRow>
      </ModuleFormSection>
    ),

    orders: (
      <ModuleFormSection
        id="orders"
        title={t("orders.title")}
        description={t("orders.description")}
      >
        <TextField
          id="orders-low-stock"
          type="email"
          label={t("orders.lowStockEmail")}
          hint={t("orders.lowStockEmailHint")}
          value={draft.plain["orders.low_stock_email"]}
          disabled={disabled}
          onChange={(value) => setPlain("orders.low_stock_email", value)}
        />
      </ModuleFormSection>
    ),
  };

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <ModuleTabs
        tabs={SETTINGS_SECTIONS.map((section) => ({
          id: section.id,
          label: t(`tabs.${section.labelKey}`),
          content: panels[section.id],
        }))}
      />

      {canUpdate ? (
        <Button type="submit" disabled={pending}>
          <Save aria-hidden="true" />
          {tAdmin("actions.saveChanges")}
        </Button>
      ) : null}
    </form>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={200}
        value={value}
        disabled={disabled}
        className="tabular-nums"
        onChange={(event) => onChange(Number(event.target.value) || 1)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
