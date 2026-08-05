import { useTranslations } from "next-intl";
import { Construction } from "lucide-react";

import { ModuleFormSection } from "@/components/admin/module/module-form";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";

/**
 * What a settings tab shows when the feature behind it does not exist yet.
 *
 * It states three things, because an operator who opens a tab and finds nothing
 * cannot tell which of them is true: that the section is **not built**, **why**,
 * and **what has to land first**.
 *
 * The alternative shapes are both worse. Hiding the tab means the store's
 * roadmap is invisible to the person running it, and they ask a developer
 * whether tax rules exist. Rendering an empty form means they fill it in and
 * lose the work — which is the failure ADR-20 exists to prevent, arrived at from
 * the other direction: not fake data, but a fake control.
 *
 * No inputs, deliberately. Nothing here can be typed into, so nothing can be
 * discarded.
 *
 * `useTranslations` rather than `getTranslations`: this renders inside the
 * settings form, which is a Client Component.
 */
export function PlannedSection({
  id,
  blockedBy,
}: {
  id: string;
  blockedBy?: string;
}) {
  const t = useTranslations("adminSystem.settings.planned");
  const tTabs = useTranslations("adminSystem.settings.tabs");

  return (
    <ModuleFormSection
      id={id}
      title={tTabs(id)}
      aside={<ModuleStatusBadge tone="muted">{t("badge")}</ModuleStatusBadge>}
    >
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
        <Construction
          className="size-5 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {t("body")}
        </p>
        {blockedBy ? (
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            <span className="font-medium text-foreground">{t("blocked")}:</span>{" "}
            {t(`reasons.${blockedBy}`)}
          </p>
        ) : null}
      </div>
    </ModuleFormSection>
  );
}
