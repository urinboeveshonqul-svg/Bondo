import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Package } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/guards";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import { createClient } from "@/supabase/server";
import * as ordersService from "@/services/orders.service";
import type { PageParams } from "@/types";
import { formatDate, formatPrice } from "@/utils/format";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

/**
 * Order history.
 *
 * **RLS is what scopes this**, not the query: `listMyOrders` filters on
 * `user_id` for the index, but a customer asking for somebody else's rows gets
 * nothing back because the policy says `user_id = auth.uid()` (ADR-4).
 *
 * Orders placed as a guest appear here the moment they are claimed — the same
 * row, moved, so the reference and the timeline a manager has been working are
 * the ones the customer sees (ADR-70).
 */
export default async function AccountOrdersPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { user } = await requireUser(routes.account.orders);
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("account.orders");

  const supabase = await createClient();
  const orders = await ordersService.listMyOrders(supabase, user.id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button asChild>
              <Link href={routes.catalog.index}>{t("startShopping")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              {/*
                The whole card is the link, so the tap target is the card rather
                than a "view" affordance somewhere inside it — which is what a
                thumb expects on a list of records.
              */}
              <Link
                href={routes.account.order(order.id)}
                className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">
                      {order.reference}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.placed_at, activeLocale)}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {t("itemCount", { count: order.itemCount })}
                    {" · "}
                    {t(`deliveryMethod.${order.delivery_method}`)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatPrice(order.total_cents, activeLocale)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
