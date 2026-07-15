"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import { ForceCloseSessionDialog } from "@/modules/sessions/components/force-close-session-dialog";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { MobileEntityCard } from "@/components/SweetFlow/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/SweetFlow/responsive-list-layout";
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
  const router = useRouter();

  if (summaries.length === 0) {
    return (
      <EmptyStateBlock
        title="مفيش جلسات مفتوحة"
        description="افتح جلسة عشان تتابع مبيعات الكاشير والنقدية المتوقعة."
      />
    );
  }

  return (
    <ResponsiveListLayout
      mobile={summaries.map((summary) => {
        const isCurrentCashier = summary.session.cashier_id === currentCashierId;
        const showForceClose =
          canForceClose &&
          allowManagerForceClose &&
          !isCurrentCashier &&
          (summary.lifecycle === "warning" || summary.lifecycle === "expired_locked");
        return (
          <MobileEntityCard
            key={summary.session.id}
            href={`/sessions/${summary.session.id}`}
            title={summary.cashierName}
            subtitle={showStoreColumn ? summary.storeName : undefined}
            badge={<SessionLifecycleBadge lifecycle={summary.lifecycle} />}
            fields={[
              { label: "الفتح", value: formatOpened(summary.openedAt) },
              { label: "المدة", value: summary.durationLabel },
              { label: "المبيعات", value: formatCurrency(summary.totalSales) },
              { label: "النقدية المتوقعة", value: formatCurrency(summary.expectedCash) },
            ]}
            trailingHint="عرض الفواتير ←"
            footer={
              showForceClose ? (
                <ForceCloseSessionDialog summary={summary} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {isCurrentCashier ? "اقفل جلستك من الأسفل" : "مفيش إجراء"}
                </span>
              )
            }
          />
        );
      })}
      desktop={
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
                const href = `/sessions/${summary.session.id}`;

                return (
                  <TableRow
                    key={summary.session.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(href)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(href);
                      }
                    }}
                    className={cn(
                      "cursor-pointer",
                      summary.lifecycle === "expired_locked" && "bg-destructive/5",
                      summary.lifecycle === "warning" && "bg-amber-50/70 dark:bg-amber-500/10"
                    )}
                  >
                    {showStoreColumn ? (
                      <TableCell className="font-medium">{summary.storeName}</TableCell>
                    ) : null}
                    <TableCell className="font-medium text-primary">
                      {summary.cashierName}
                    </TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      {showForceClose ? (
                        <ForceCloseSessionDialog summary={summary} />
                      ) : (
                        <Link
                          href={href}
                          className="text-xs font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          عرض الفواتير
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableShell>
      }
    />
  );
}
