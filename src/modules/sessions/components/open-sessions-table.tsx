"use client";

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

function formatOpened(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
        title="مفيش جلسات مفتوحة"
        description="افتح جلسة عشان تتابع مبيعات الكاشير والنقدية المتوقعة."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-3)]">
      <div className="grid gap-[var(--mds-space-3)] md:hidden">
        {summaries.map((summary) => {
          const isCurrentCashier = summary.session.cashier_id === currentCashierId;
          const showForceClose =
            canForceClose &&
            allowManagerForceClose &&
            !isCurrentCashier &&
            (summary.lifecycle === "warning" || summary.lifecycle === "expired_locked");
          return (
            <div key={summary.session.id} className="rounded-[var(--mds-radius-md)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium">{summary.cashierName}</p>
                <SessionLifecycleBadge lifecycle={summary.lifecycle} />
              </div>
              {showStoreColumn ? (
                <p className="mb-2 text-xs text-muted-foreground">{summary.storeName}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-muted-foreground">الفتح</p>
                <p>{formatOpened(summary.openedAt)}</p>
                <p className="text-muted-foreground">المدة</p>
                <p>{summary.durationLabel}</p>
                <p className="text-muted-foreground">المبيعات</p>
                <p>{formatCurrency(summary.totalSales)}</p>
                <p className="text-muted-foreground">النقدية المتوقعة</p>
                <p>{formatCurrency(summary.expectedCash)}</p>
              </div>
              <div className="mt-3 text-xs">
                {showForceClose ? (
                  <ForceCloseSessionDialog summary={summary} />
                ) : isCurrentCashier ? (
                  <span className="text-muted-foreground">اقفل جلستك من الأسفل</span>
                ) : (
                  <span className="text-muted-foreground">مفيش إجراء</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <DataTableShell title="الجلسات المفتوحة">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {showStoreColumn ? <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الفرع</TableHead> : null}
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الكاشير</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الجهاز</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الفتح</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">المدة</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الطلبات</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">المبيعات</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">نقدي</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">كارت</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">أخرى</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">مصروفات</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">نقدية متوقعة</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">آخر طلب</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الحالة</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">إجراءات</TableHead>
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
                      summary.lifecycle === "warning" && "bg-amber-50/70 dark:bg-amber-500/10"
                    )}
                  >
                    {showStoreColumn ? (
                      <TableCell className="font-medium">{summary.storeName}</TableCell>
                    ) : null}
                    <TableCell className="font-medium">{summary.cashierName}</TableCell>
                    <TableCell className="text-muted-foreground">{summary.deviceName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatOpened(summary.openedAt)}</TableCell>
                    <TableCell className="tabular-nums">{summary.durationLabel}</TableCell>
                    <TableCell className="tabular-nums">{summary.orderCount}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.totalSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.cashSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.cardSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.otherSales)}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(summary.sessionExpenses)}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatCurrency(summary.expectedCash)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {summary.lastOrderAt ? formatTime(summary.lastOrderAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <SessionLifecycleBadge lifecycle={summary.lifecycle} />
                    </TableCell>
                    <TableCell>
                      {showForceClose ? (
                        <ForceCloseSessionDialog summary={summary} />
                      ) : isCurrentCashier ? (
                        <span className="text-xs text-muted-foreground">اقفل من الأسفل</span>
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
