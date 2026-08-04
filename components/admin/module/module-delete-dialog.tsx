"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

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

/**
 * The confirmation in front of every destructive action in the panel.
 *
 * Four decisions, all of them about the same thing — making the cost of a
 * mistake proportional to the size of it:
 *
 * **The name is in the title.** "Delete this item?" is a question nobody reads.
 * "Delete Bondo Forge RTX 4080?" is one they answer correctly, because it is the
 * first place the wrong row becomes visible.
 *
 * **Bulk deletes say how many.** A count is the only signal that the selection
 * was not what the operator thought it was.
 *
 * **`confirmText` demands the name typed back.** Reserved for the irreversible —
 * a soft delete does not need it, a role does. The default is off, because a
 * confirmation everyone types by reflex protects nothing.
 *
 * **The confirm button is `destructive` and is not the default focus.** Enter on
 * an unexamined dialog should cancel.
 *
 * Localized through `admin.confirm.*`, so a module never writes its own delete
 * copy — which is how one of them ends up promising a recovery that does not
 * exist.
 */
export function ModuleDeleteDialog({
  open,
  onOpenChange,
  name,
  count,
  description,
  confirmText = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The record's name. Ignored when `count` is given. */
  name?: string;
  /** Number of selected records, for a bulk delete. */
  count?: number;
  /** Overrides the default body — say what else the delete takes with it. */
  description?: string;
  /** Require the name typed back. For anything that cannot be restored. */
  confirmText?: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("admin.confirm");
  const [typed, setTyped] = useState("");

  const isBulk = typeof count === "number";
  const title = isBulk
    ? t("deleteManyTitle", { count })
    : t("deleteTitle", { name: name ?? "" });

  const mustType = confirmText && !isBulk && Boolean(name);
  const canConfirm = !mustType || typed.trim() === name;

  function handleOpenChange(next: boolean) {
    if (!next) setTyped("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description ?? t("deleteBody")}
          </DialogDescription>
        </DialogHeader>

        {mustType ? (
          <div className="space-y-2">
            <Label htmlFor="module-delete-confirm">
              {t("typeToConfirm", { name: name ?? "" })}
            </Label>
            <Input
              id="module-delete-confirm"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm();
              handleOpenChange(false);
            }}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
