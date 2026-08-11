"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  updateOrderDetails,
  updateOrderStatus,
} from "@/actions/orders.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { OrderStatus } from "@/services/orders.service";
import { nextOrderStatuses } from "@/utils/admin";

/**
 * The two things an operator does to an order: move it along, and write down
 * what happened on the phone.
 *
 * ## Forward only, and cancelling asks first
 *
 * The buttons come from `nextOrderStatuses`, which offers the next step and
 * `cancelled` and nothing else — there is no way to walk an order backwards
 * from this screen. That is deliberate and documented at the helper: `delivered`
 * is what unlocks the customer's right to review (ADR-66), so reversing it would
 * strand a review that already exists.
 *
 * Cancelling is the one irreversible move, so it is the one behind a
 * confirmation. Every other transition is a step the next one can continue from.
 *
 * ## The note is a separate write
 *
 * `updateOrderDetails`, not a field on the status action: an operator who types
 * a note and then presses "confirm" should not lose the note if the transition
 * is refused, and a status change should not silently carry whatever was in the
 * textarea.
 */
export function OrderWorkflow({
  orderId,
  status,
  internalNote,
  canUpdate,
}: {
  orderId: string;
  status: OrderStatus;
  internalNote: string | null;
  canUpdate: boolean;
}) {
  const t = useTranslations("adminOrders");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(internalNote ?? "");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const router = useRouter();

  const transitions = nextOrderStatuses(status);

  function move(next: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatus({ id: orderId, status: next });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t("actions.statusChanged"));
      setConfirmingCancel(false);
      router.refresh();
    });
  }

  function saveNote() {
    startTransition(async () => {
      const result = await updateOrderDetails({
        id: orderId,
        internalNote: note.trim() ? note.trim() : null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(t("actions.noteSaved"));
      router.refresh();
    });
  }

  if (!canUpdate) return null;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">{t("actions.title")}</h2>

        {transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("actions.noneLeft")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {transitions.map((next) =>
              next === "cancelled" ? (
                <Button
                  key={next}
                  variant="outline"
                  disabled={pending}
                  className="h-11 justify-start text-destructive lg:h-8"
                  onClick={() => setConfirmingCancel(true)}
                >
                  {t("actions.cancelled")}
                </Button>
              ) : (
                <Button
                  key={next}
                  disabled={pending}
                  className="h-11 justify-start lg:h-8"
                  onClick={() => move(next)}
                >
                  {t(`actions.${next}`)}
                </Button>
              ),
            )}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <Label htmlFor="internal-note" className="text-sm font-medium">
          {t("detail.internalNoteTitle")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("detail.internalNoteHint")}
        </p>
        <Textarea
          id="internal-note"
          rows={4}
          value={note}
          disabled={pending}
          placeholder={t("detail.internalNotePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={pending || note.trim() === (internalNote ?? "").trim()}
          onClick={saveNote}
        >
          {t("detail.saveNote")}
        </Button>
      </section>

      {/*
        A plain `Dialog` rather than a new `AlertDialog` primitive. Radix's
        alert variant differs by trapping focus on the *cancel* action and
        refusing to close on outside click; that is the right default for a
        destructive prompt, and it is not worth a new dependency for the one
        place this codebase currently needs it. The destructive action is
        explicitly styled and is not the focused control.
      */}
      <Dialog open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("actions.cancelTitle")}</DialogTitle>
            <DialogDescription>{t("actions.cancelBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmingCancel(false)}
            >
              {t("actions.cancelDismiss")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => move("cancelled")}
            >
              {t("actions.cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
