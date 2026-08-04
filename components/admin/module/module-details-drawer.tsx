"use client";

import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The read-only detail view for a row.
 *
 * A drawer rather than a route, because the question it answers is "what is this
 * row" and the answer is worth nothing if it costs the operator their place in a
 * filtered, sorted, paginated list. Editing still navigates: an edit is long
 * enough to deserve a URL, and a URL is what makes it shareable and recoverable.
 *
 * Below `sm` it becomes a bottom sheet — a 400px side panel on a phone is a
 * column two words wide.
 *
 * `ModuleDetailField` is a `<dl>` pair rather than two divs so the label and the
 * value are associated for a screen reader. A table of unlabelled values is the
 * usual shape of this component and it reads as a list of orphaned strings.
 */
export function ModuleDetailsDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Actions — usually "Edit" and "Close". */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin.details");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description ?? t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 pb-4">
          <dl className="divide-y">{children}</dl>
        </div>

        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}

export function ModuleDetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3 py-3",
        className,
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}
