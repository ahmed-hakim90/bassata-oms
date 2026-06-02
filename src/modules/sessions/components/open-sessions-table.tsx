"use client";

import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import { ForceCloseSessionDialog } from "@/modules/sessions/components/force-close-session-dialog";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";

interface OpenSessionsTableProps {
  summaries: OpenSessionSummary[];
  currentCashierId: string | null;
  canForceClose: boolean;
  allowManagerForceClose: boolean;
  showStoreColumn?: boolean;
}

export function OpenSessionsTable({
  summaries,
  currentCashierId,
  canForceClose,
  allowManagerForceClose,
  showStoreColumn = false,
}: OpenSessionsTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-black/5">
        No open sessions
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/5 text-xs uppercase tracking-wide text-muted-foreground">
            {showStoreColumn ? <th className="px-4 py-3 font-medium">Store</th> : null}
            <th className="px-4 py-3 font-medium">Cashier</th>
            <th className="px-4 py-3 font-medium">Device</th>
            <th className="px-4 py-3 font-medium">Opened</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Orders</th>
            <th className="px-4 py-3 font-medium">Sales</th>
            <th className="px-4 py-3 font-medium">Cash</th>
            <th className="px-4 py-3 font-medium">Card</th>
            <th className="px-4 py-3 font-medium">Other</th>
            <th className="px-4 py-3 font-medium">Expenses</th>
            <th className="px-4 py-3 font-medium">Expected cash</th>
            <th className="px-4 py-3 font-medium">Last order</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const isCurrentCashier = summary.session.cashier_id === currentCashierId;
            const showForceClose =
              canForceClose &&
              allowManagerForceClose &&
              !isCurrentCashier &&
              (summary.lifecycle === "warning" || summary.lifecycle === "expired_locked");

            return (
              <tr
                key={summary.session.id}
                className={cn(
                  "border-b border-black/5 last:border-0",
                  summary.lifecycle === "expired_locked" && "bg-destructive/5",
                  summary.lifecycle === "warning" && "bg-amber-50/70"
                )}
              >
                {showStoreColumn ? (
                  <td className="px-4 py-3 font-medium">{summary.storeName}</td>
                ) : null}
                <td className="px-4 py-3 font-medium">{summary.cashierName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {summary.deviceName ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {format(new Date(summary.openedAt), "MMM d, h:mm a")}
                </td>
                <td className="px-4 py-3 tabular-nums">{summary.durationLabel}</td>
                <td className="px-4 py-3 tabular-nums">{summary.orderCount}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(summary.totalSales)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(summary.cashSales)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(summary.cardSales)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(summary.otherSales)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatCurrency(summary.sessionExpenses)}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {formatCurrency(summary.expectedCash)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {summary.lastOrderAt
                    ? format(new Date(summary.lastOrderAt), "h:mm a")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <SessionLifecycleBadge lifecycle={summary.lifecycle} />
                </td>
                <td className="px-4 py-3">
                  {showForceClose ? (
                    <ForceCloseSessionDialog summary={summary} />
                  ) : isCurrentCashier ? (
                    <span className="text-xs text-muted-foreground">Use close stepper</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
