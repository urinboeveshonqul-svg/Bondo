"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * The tab strip modules use to split one screen into views — the settings
 * groups, the team's members and roles, an inventory list beside its ledger.
 *
 * A thin frame over the shadcn primitive, existing for one reason: to keep the
 * strip's shape identical everywhere. A tab bar that is pills on one screen and
 * underlines on the next reads as two different applications.
 *
 * The count badge is part of the contract rather than something each caller
 * appends, because "Members 4" and "Roles (5)" in the same strip is the kind of
 * inconsistency nobody files a bug about and everybody notices.
 *
 * **This is not the language switcher.** Translations use
 * `ModuleLanguageTabs`, which is a different control with different semantics —
 * a language tab switches which copy of a field you are editing, not which part
 * of the screen you are looking at.
 */

export type ModuleTabDefinition = {
  id: string;
  label: string;
  /** Rendered as a pill beside the label. Omit for no badge. */
  count?: number;
  icon?: React.ReactNode;
  content: React.ReactNode;
};

export function ModuleTabs({
  tabs,
  defaultTab,
  value,
  onValueChange,
  className,
}: {
  tabs: readonly ModuleTabDefinition[];
  defaultTab?: string;
  /** Controlled mode. Omit both to let the strip manage itself. */
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  const first = tabs[0];
  if (!first) return null;

  return (
    <Tabs
      defaultValue={value === undefined ? (defaultTab ?? first.id) : undefined}
      value={value}
      onValueChange={onValueChange}
      className={cn("gap-5", className)}
    >
      {/* Scrolls rather than wraps: eight settings tabs on a phone become four
          rows of chrome above the content otherwise. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.icon}
              {tab.label}
              {typeof tab.count === "number" ? (
                <span className="ms-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">
                  {tab.count}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="space-y-5">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
