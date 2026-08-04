import { useTranslations } from "next-intl";

import {
  MODULE_FORM_SECTIONS,
  type ModuleFormSection as ModuleFormSectionId,
} from "@/lib/admin/module";
import { cn } from "@/lib/utils";

/**
 * The create/edit form layout, identical in every module.
 *
 * ## One section vocabulary
 *
 * A form declares which of the eight canonical sections it uses; it does not
 * choose their order or their names. The order is fixed in
 * `lib/admin/module.ts` and runs from what the thing *is* to whether the world
 * can *see* it:
 *
 *     general → media → pricing → inventory → seo → localization → advanced → publish
 *
 * That is worth enforcing because an operator switching from products to pages
 * should not have to re-learn where publishing lives. It is enforced by the
 * type rather than by review: `sections` is keyed by the canonical union, so a
 * module cannot invent "Basics" or put SEO first — the object is rendered in the
 * order declared here regardless of the order it was written in.
 *
 * ## Titles default to the shared vocabulary
 *
 * A section may pass its own title, but the default comes from
 * `admin.form.sections.*` and translates once. Every module calling its first
 * section "General" in three languages is the outcome; three modules calling it
 * "Basics", "Details" and "Overview" is what happens without this.
 *
 * ## The action bar is sticky and states what will happen
 *
 * A product form is longer than a viewport, and a Save that requires scrolling
 * to the bottom of a form the operator has already finished reading is a Save
 * that gets missed.
 *
 * No `"use client"`: this is layout. The interactive parts — fields, the
 * submit handler — are passed in by the module's own client component, so a
 * form section that is only markup stays markup.
 */

export type ModuleFormSectionContent = {
  /** Defaults to the shared name for this section. */
  title?: string;
  description?: string;
  /** A control beside the heading — a toggle, a status badge. */
  aside?: React.ReactNode;
  children: React.ReactNode;
};

export function ModuleForm({
  sections,
  aside,
  actions,
  notice,
  onSubmit,
  className,
}: {
  sections: Partial<Record<ModuleFormSectionId, ModuleFormSectionContent>>;
  /** A sticky sidebar — translation coverage, a summary, related records. */
  aside?: React.ReactNode;
  /** Save and Cancel. Rendered in the sticky bar at the foot of the form. */
  actions?: React.ReactNode;
  /** Shown above the first section — a read-only banner, an unsaved warning. */
  notice?: React.ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  const t = useTranslations("admin.form");

  const present = MODULE_FORM_SECTIONS.filter((id) => sections[id]);

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "grid items-start gap-5",
        aside ? "lg:grid-cols-[minmax(0,1fr)_320px]" : undefined,
        className,
      )}
    >
      <div className="min-w-0 space-y-5">
        {notice}

        {present.map((id) => {
          const section = sections[id];
          if (!section) return null;

          return (
            <ModuleFormSection
              key={id}
              id={id}
              title={section.title ?? t(`sections.${id}`)}
              description={section.description}
              aside={section.aside}
            >
              {section.children}
            </ModuleFormSection>
          );
        })}

        {actions ? (
          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            {actions}
          </div>
        ) : null}
      </div>

      {aside ? (
        <aside className="space-y-5 lg:sticky lg:top-20">{aside}</aside>
      ) : null}
    </form>
  );
}

/**
 * A titled block within a form.
 *
 * A product editor with twenty fields in one column is unreadable; the same
 * twenty grouped under General / Pricing / Publish is scannable. The heading is a
 * real `h2` tied to the `section` with `aria-labelledby`, so the groups are
 * navigable by heading rather than being visual-only.
 *
 * Exported on its own for the screens that are editors without being forms — the
 * settings groups, the homepage composer — so they sit on the same grid without
 * pretending to have a submit button.
 */
export function ModuleFormSection({
  id,
  title,
  description,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  /** Secondary control shown beside the heading, e.g. a status toggle. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `form-section-${id}`;

  return (
    <section
      id={`section-${id}`}
      aria-labelledby={headingId}
      className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id={headingId} className="font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {aside}
      </div>

      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Two fields side by side on desktop, stacked below `sm`. */
export function ModuleFormRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>
  );
}
