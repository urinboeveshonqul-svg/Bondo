import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/admin";

/**
 * The status, as a customer reads it.
 *
 * Deliberately not `ModuleStatusBadge` from the admin kit: that component's
 * tones mean "needs attention" to an operator working a queue, and a shopper
 * looking at their own order needs the opposite reading — `new` is reassuring to
 * them and a task to us.
 *
 * Only two states are coloured. Everything mid-pipeline is neutral because it is
 * simply in progress, `delivered` is the good end, and `cancelled` is the one a
 * reader must not miss.
 */
const TONE: Record<OrderStatus, string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-muted text-muted-foreground",
  confirmed: "bg-muted text-muted-foreground",
  preparing: "bg-muted text-muted-foreground",
  shipped: "bg-muted text-muted-foreground",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const t = useTranslations("account.orderStatus");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[status],
        className,
      )}
    >
      {t(`${status}.label`)}
    </span>
  );
}
