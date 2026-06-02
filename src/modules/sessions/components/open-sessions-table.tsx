"use client";

import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import { ForceCloseSessionDialog } from "@/modules/sessions/components/force-close-session-dialog";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <EmptyStateBlock
        title="No open sessions yet"
        description="Open a session to monitor cashier activity and live totals."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:hidden">
        {summaries.map((summary) => {
          const isCurrentCashier = summary.session.cashier_id === currentCashierId;
          const showForceClose =
            canForceClose &&
            allowManagerForceClose &&
            !isCurrentCashier &&
            (summary.lifecycle === "warning" || summary.lifecycle === "expired_locked");
          return (
            <div key={summary.session.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{summary.cashierName}</p>
                <SessionLifecycleBadge lifecycle={summary.lifecycle} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-muted-foreground">Opened</p>
                <p>{format(new Date(summary.openedAt), "MMM d, h:mm a")}</p>
                <p className="text-muted-foreground">Duration</p>
                <p>{summary.durationLabel}</p>
                <p className="text-muted-foreground">Sales</p>
                <p>{formatCurrency(summary.totalSales)}</p>
                <p className="text-muted-foreground">Expected cash</p>
                <p>{formatCurrency(summary.expectedCash)}</p>
              </div>
              <div className="mt-3 text-xs">
                {showForceClose ? (
                  <ForceCloseSessionDialog summary={summary} />
                ) : isCurrentCashier ? (
                  <span className="text-muted-foreground">Use close stepper</span>
                ) : (
                  <span className="text-muted-foreground">No actions</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <DataTableShell title="Open sessions">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                {showStoreColumn ? <TableHead>Store</TableHead> : null}
                <TableHead>Cashier</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Card</TableHead>
                <TableHead>Other</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Expected cash</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => {
                const isCurrentCashier = summary.session.cashier_id === currentCashierId;
                const showForceClose =
                  canForceClose &&
                  allowManagerForceClose &&
                  !isCurrentCashier &&
                  (summary.lifecycle === "warning" || summary.lifecycle === "expired_locked");

                return (
                  <TableRow
                    key={summary.session.id}
                    className={cn(
                      summary.lifecycle === "expired_locked" && "bg-destructive/5",
                      summary.lifecycle === "warning" && "bg-amber-50/70"
                    )}
                  >
                    {showStoreColumn ? (
                      <TableCell className="font-medium">{summary.storeName}</TableCell>
                    ) : null}
                    <TableCell className="font-medium">{summary.cashierName}</TableCell>
                    <TableCell className="text-muted-foreground">{summary.deviceName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(summary.openedAt), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="tabular-nums">{summary.durationLabel}</TableCell>
                    <TableCell className="tabular-nums">{summary.orderCount}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.totalSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.cashSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.cardSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.otherSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.sessionExpenses)}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatCurrency(summary.expectedCash)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {summary.lastOrderAt ? format(new Date(summary.lastOrderAt), "h:mm a") : "—"}
                    </TableCell>
                    <TableCell>
                      <SessionLifecycleBadge lifecycle={summary.lifecycle} />
                    </TableCell>
                    <TableCell>
                      {showForceClose ? (
                        <ForceCloseSessionDialog summary={summary} />
                      ) : isCurrentCashier ? (
                        <span className="text-xs text-muted-foreground">Use close stepper</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableShell>
      </div>
    </div>
  );
}
