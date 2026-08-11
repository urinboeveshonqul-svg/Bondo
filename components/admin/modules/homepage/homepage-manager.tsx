"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteBanner,
  saveBanner,
  setBannerActive,
} from "@/actions/banners.actions";
import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { LocalizedField } from "@/components/admin/module/module-localized-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import type { ModuleCapabilities } from "@/lib/admin/module";
import { locales, type Locale } from "@/lib/site-config";
import { formatDate } from "@/utils/format";
import type { EditableBanner } from "@/types/admin";

/**
 * Homepage banners.
 *
 * ## The section editor is gone
 *
 * This screen used to open on a "sections" tab: eight reorderable bands with a
 * type, a target and a visibility switch, over `homepageSections` in
 * `mocks/admin.ts`, with a Save button that raised `notSaved()`. There is no
 * table behind any of it, and the home page does not compose itself that way —
 * it derives its rails from the category tree and their order from
 * `categories.display_order` (ADR-75), which an operator already controls in
 * `/admin/categories`.
 *
 * Persisting it would have meant inventing a `homepage_sections` table that
 * nothing reads, which is the same lie as the fixture with a migration attached.
 * So the tab is removed and the thing that does have a table — banners — is now
 * genuinely editable.
 */
const PLACEMENTS = [
  "home_hero",
  "home_secondary",
  "category_top",
  "site_wide_notice",
] as const;

const emptyText = () =>
  Object.fromEntries(locales.map((locale) => [locale, ""])) as Record<
    Locale,
    string
  >;

const blank = (): EditableBanner => ({
  placement: "home_hero",
  linkUrl: "",
  displayOrder: 0,
  isActive: false,
  startsAt: null,
  endsAt: null,
  title: emptyText(),
  subtitle: emptyText(),
  ctaLabel: emptyText(),
});

export function HomepageManager({
  banners,
  capabilities,
}: {
  banners: readonly EditableBanner[];
  capabilities: ModuleCapabilities;
}) {
  const canManage = capabilities.update;
  const t = useTranslations("adminHomepage");
  const tAdmin = useTranslations("admin");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableBanner | null>(null);

  function persist(banner: EditableBanner) {
    startTransition(async () => {
      const result = await saveBanner({
        ...(banner.id ? { id: banner.id } : {}),
        placement: banner.placement,
        linkUrl: banner.linkUrl,
        displayOrder: banner.displayOrder,
        isActive: banner.isActive,
        startsAt: banner.startsAt,
        endsAt: banner.endsAt,
        translations: Object.fromEntries(
          locales.map((each) => [
            each,
            {
              title: banner.title[each],
              subtitle: banner.subtitle[each],
              ctaLabel: banner.ctaLabel[each],
            },
          ]),
        ) as Record<
          Locale,
          { title: string; subtitle: string; ctaLabel: string }
        >,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.save"));
      setEditing(null);
      router.refresh();
    });
  }

  function toggle(banner: EditableBanner) {
    if (!banner.id) return;

    startTransition(async () => {
      const result = await setBannerActive({
        id: banner.id,
        isActive: !banner.isActive,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  function remove(banner: EditableBanner) {
    if (!banner.id) return;

    startTransition(async () => {
      const result = await deleteBanner({ id: banner.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(tAdmin("actions.delete"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("banners.description")}
        </p>

        {canManage ? (
          <Button onClick={() => setEditing(blank())} disabled={pending}>
            <Plus aria-hidden="true" />
            {t("banners.new")}
          </Button>
        ) : null}
      </div>

      {banners.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">{t("banners.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("banners.emptyDescription")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {banners.map((banner) => (
            <li
              key={banner.id}
              className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium text-balance">
                  {banner.title[locale]}
                </p>
                {banner.subtitle[locale] ? (
                  <p className="text-sm text-pretty text-muted-foreground">
                    {banner.subtitle[locale]}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t(`placements.${banner.placement}`)}
                  {banner.linkUrl ? ` → ${banner.linkUrl}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <ModuleStatusBadge tone={banner.isActive ? "success" : "muted"}>
                  {banner.isActive ? t("visible") : t("hidden")}
                </ModuleStatusBadge>
                <span className="text-xs text-muted-foreground">
                  {banner.startsAt
                    ? t("banners.scheduled", {
                        from: formatDate(banner.startsAt, locale),
                        to: banner.endsAt
                          ? formatDate(banner.endsAt, locale)
                          : t("banners.openEnded"),
                      })
                    : t("banners.always")}
                </span>

                {canManage ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggle(banner)}
                    >
                      {banner.isActive
                        ? tAdmin("actions.hide")
                        : tAdmin("actions.publish")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={tAdmin("actions.edit")}
                      disabled={pending}
                      onClick={() => setEditing(banner)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={tAdmin("actions.delete")}
                      disabled={pending}
                      onClick={() => remove(banner)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editing.id ? tAdmin("actions.edit") : t("banners.new")}
                </DialogTitle>
                <DialogDescription>{t("banners.dialogHint")}</DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  persist(editing);
                }}
              >
                <LocalizedField
                  label={t("banners.fields.title")}
                  value={editing.title}
                  disabled={pending}
                  required
                  onChange={(title) => setEditing({ ...editing, title })}
                />
                <LocalizedField
                  label={t("banners.fields.subtitle")}
                  value={editing.subtitle}
                  multiline
                  rows={2}
                  disabled={pending}
                  onChange={(subtitle) => setEditing({ ...editing, subtitle })}
                />
                <LocalizedField
                  label={t("banners.fields.ctaLabel")}
                  value={editing.ctaLabel}
                  disabled={pending}
                  onChange={(ctaLabel) => setEditing({ ...editing, ctaLabel })}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="banner-placement">
                      {t("banners.fields.placement")}
                    </Label>
                    <Select
                      value={editing.placement}
                      onValueChange={(value) =>
                        setEditing({
                          ...editing,
                          placement: value as EditableBanner["placement"],
                        })
                      }
                    >
                      <SelectTrigger id="banner-placement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACEMENTS.map((placement) => (
                          <SelectItem key={placement} value={placement}>
                            {t(`placements.${placement}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="banner-link">
                      {t("banners.fields.ctaHref")}
                    </Label>
                    <Input
                      id="banner-link"
                      value={editing.linkUrl}
                      disabled={pending}
                      onChange={(event) =>
                        setEditing({ ...editing, linkUrl: event.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DateField
                    id="banner-starts"
                    label={t("banners.fields.startsAt")}
                    value={editing.startsAt}
                    disabled={pending}
                    onChange={(startsAt) =>
                      setEditing({ ...editing, startsAt })
                    }
                  />
                  <DateField
                    id="banner-ends"
                    label={t("banners.fields.endsAt")}
                    value={editing.endsAt}
                    disabled={pending}
                    onChange={(endsAt) => setEditing({ ...editing, endsAt })}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <Label htmlFor="banner-active" className="font-normal">
                    {t("banners.fields.visible")}
                  </Label>
                  <Switch
                    id="banner-active"
                    checked={editing.isActive}
                    disabled={pending}
                    onCheckedChange={(isActive) =>
                      setEditing({ ...editing, isActive })
                    }
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(null)}
                  >
                    {tAdmin("actions.cancel")}
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {tAdmin("actions.save")}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * A date window bound, as a `datetime-local` input.
 *
 * The column is `timestamptz` and the control speaks local time with no zone, so
 * the value is converted at the boundary rather than stored as typed — a banner
 * scheduled for 09:00 in Tashkent must not start at 09:00 UTC.
 */
function DateField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  disabled: boolean;
  onChange: (value: string | null) => void;
}) {
  const local = value ? new Date(value).toISOString().slice(0, 16) : "";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={local}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value
              ? new Date(event.target.value).toISOString()
              : null,
          )
        }
      />
    </div>
  );
}
