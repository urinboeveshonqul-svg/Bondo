"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Phone, Search, Send } from "lucide-react";

import { ModuleStatusBadge } from "@/components/admin/module/module-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import { ORDER_STATUSES, statusTone } from "@/utils/admin";
import { routes } from "@/lib/routes";
import type { Locale } from "@/lib/site-config";
import type { OrderListRow } from "@/services/orders.service";
import { formatDate, formatPrice } from "@/utils/format";

/**
 * The order queue.
 *
 * ## The filters are URL state
 *
 * Same reasoning as the catalog listing (ADR-78): an operator who has filtered
 * to "waiting on a call" and opened an order gets that filter back when they
 * come out of it, and can send the view to a colleague. `useState` would lose
 * it on every navigation, which on this screen means losing your place in a
 * queue you are working through.
 *
 * ## Cards on a phone, a table from `lg`
 *
 * Seven columns do not fit 390px, and a horizontally scrolling table is the
 * worst of both. The same rows render as cards below `lg`, with the two things
 * an operator acts on — the phone number and the status — kept visible.
 */
export function OrdersTable({
  orders,
  page,
  totalPages,
  total,
  status,
  search,
}: {
  orders: readonly OrderListRow[];
  page: number;
  totalPages: number;
  total: number;
  status: string;
  search: string;
}) {
  const t = useTranslations("adminOrders");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draftSearch, setDraftSearch] = useState(search);

  const go = (next: { status?: string; q?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    const nextSearch = next.q ?? search;

    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextSearch) params.set("q", nextSearch);
    if (next.page && next.page > 1) params.set("page", String(next.page));

    const qs = params.toString();
    startTransition(() => {
      router.push(`${routes.admin.orders}${qs ? `?${qs}` : ""}`);
    });
  };

  const hasFilters = (status && status !== "all") || Boolean(search);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            go({ q: draftSearch.trim(), page: 1 });
          }}
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder={t("filters.search")}
            aria-label={t("filters.search")}
            className="ps-9"
          />
        </form>

        <Select
          value={status || "all"}
          onValueChange={(value) => go({ status: value, page: 1 })}
        >
          <SelectTrigger
            aria-label={t("filters.status")}
            className="w-full lg:w-56"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
            {ORDER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDraftSearch("");
              startTransition(() => router.push(routes.admin.orders));
            }}
          >
            {t("filters.clear")}
          </Button>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center">
          <p className="text-sm font-medium">
            {hasFilters ? t("noResultsTitle") : t("emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters ? t("noResultsDescription") : t("emptyDescription")}
          </p>
        </div>
      ) : (
        <>
          {/* Cards, up to `lg`. */}
          <ul className="space-y-3 lg:hidden">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={routes.admin.order(order.id)}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {order.reference}
                    </Link>
                    <p className="mt-0.5 truncate text-sm">
                      {order.customer_name}
                    </p>
                  </div>
                  <ModuleStatusBadge tone={statusTone(order.status)}>
                    {t(`status.${order.status}`)}
                  </ModuleStatusBadge>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{formatDate(order.placed_at, locale)}</span>
                  <span className="font-medium text-foreground">
                    {formatPrice(order.total_cents, locale)}
                  </span>
                </div>

                <ContactRow order={order} label={t("detail.call")} />
              </li>
            ))}
          </ul>

          {/* Table, from `lg`. */}
          <div className="hidden overflow-hidden rounded-xl border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start">
                <tr>
                  <Th>{t("columns.reference")}</Th>
                  <Th>{t("columns.customer")}</Th>
                  <Th>{t("columns.contact")}</Th>
                  <Th className="text-end">{t("columns.items")}</Th>
                  <Th className="text-end">{t("columns.total")}</Th>
                  <Th>{t("columns.status")}</Th>
                  <Th>{t("columns.placed")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/40">
                    <Td>
                      <Link
                        href={routes.admin.order(order.id)}
                        className="font-mono font-medium hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </Td>
                    <Td>{order.customer_name}</Td>
                    <Td>
                      <ContactRow
                        order={order}
                        label={t("detail.call")}
                        inline
                      />
                    </Td>
                    <Td className="text-end tabular-nums">{order.itemCount}</Td>
                    <Td className="text-end font-medium tabular-nums">
                      {formatPrice(order.total_cents, locale)}
                    </Td>
                    <Td>
                      <ModuleStatusBadge tone={statusTone(order.status)}>
                        {t(`status.${order.status}`)}
                      </ModuleStatusBadge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDate(order.placed_at, locale)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {tCatalog("pageOf", { page, total: totalPages })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || pending}
              onClick={() => go({ page: page - 1 })}
            >
              {tCatalog("previous")}
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages || pending}
              onClick={() => go({ page: page + 1 })}
            >
              {tCatalog("next")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("itemCount", { count: total })}
        </p>
      )}
    </div>
  );
}

/**
 * Phone and Telegram as real links.
 *
 * `tel:` and Telegram's `https://t.me/` scheme, so the operator taps once
 * rather than copying a number into another application. The Telegram handle is
 * stored as the customer typed it, so a leading `@` is stripped for the URL and
 * kept in the label.
 */
function ContactRow({
  order,
  label,
  inline = false,
}: {
  order: Pick<OrderListRow, "phone" | "telegram">;
  label: string;
  inline?: boolean;
}) {
  const handle = order.telegram?.replace(/^@/, "");

  return (
    <div className={inline ? "flex items-center gap-2" : "mt-2 flex gap-2"}>
      <a
        href={`tel:${order.phone.replace(/\s/g, "")}`}
        aria-label={`${label} ${order.phone}`}
        className="inline-flex items-center gap-1.5 rounded-md text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">{order.phone}</span>
      </a>

      {handle ? (
        <a
          href={`https://t.me/${handle}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Send className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">@{handle}</span>
        </a>
      ) : null}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-start font-medium text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className ?? ""}`}>{children}</td>;
}
