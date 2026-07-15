"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CashierSession } from "@/lib/types";

export interface ClosedSessionRow {
  session: CashierSession;
  storeName: string;
  cashierName: string;
  closedByName: string | null;
  deviceName: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface ClosedSessionsTableProps {
  rows: ClosedSessionRow[];
  showStoreColumn?: boolean;
}

export function ClosedSessionsTable({
  rows,
  showStoreColumn = false,
}: ClosedSessionsTableProps) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyStateBlock
        title="مفيش جلسات مقفولة"
        description="لما تتقفل جلسات، هتظهر هنا في الجدول للمراجعة."
      />
    );
  }

  return (
    <ResponsiveListLayout
      mobile={rows.map(({ session, storeName, cashierName, closedByName }) => (
        <MobileEntityCard
          key={session.id}
          href={`/sessions/${session.id}`}
          title={cashierName}
          subtitle={showStoreColumn ? storeName : undefined}
          badge={
            <Badge variant={session.force_closed ? "destructive" : "secondary"}>
              {session.force_closed ? "إغلاق إجباري" : "مقفولة"}
            </Badge>
          }
          fields={[
            { label: "الفتح", value: formatDateTime(session.opened_at) },
            {
              label: "الإغلاق",
              value: session.closed_at ? formatDateTime(session.closed_at) : "—",
            },
            {
              label: "المتوقع",
              value:
                session.expected_cash != null
                  ? formatCurrency(session.expected_cash)
                  : "—",
            },
            {
              label: "الفعلي",
              value:
                session.actual_cash != null
                  ? formatCurrency(session.actual_cash)
                  : "—",
            },
            {
              label: "فرق الدرج",
              value: (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    session.variance != null &&
                      session.variance !== 0 &&
                      (session.variance > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-destructive")
                  )}
                >
                  {session.variance != null
                    ? `${session.variance > 0 ? "+" : ""}${formatCurrency(session.variance)}`
                    : "—"}
                </span>
              ),
            },
          ]}
          footer={
            session.force_closed && session.close_reason ? (
              <p className="text-xs text-destructive">
                السبب: {session.close_reason}
                {closedByName ? ` · بواسطة ${closedByName}` : ""}
              </p>
            ) : undefined
          }
          trailingHint="عرض الفواتير ←"
        />
      ))}
      desktop={
        <DataTableShell title={`الجلسات المقفولة (${rows.length})`}>
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {showStoreColumn ? <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الفرع</TableHead> : null}
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الكاشير</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الجهاز</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الفتح</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الإغلاق</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">بداية الدرج</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">المتوقع</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الفعلي</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">فرق الدرج</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">الحالة</TableHead>
                <TableHead className="h-10 text-xs font-semibold text-muted-foreground">ملاحظات الإغلاق</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ session, storeName, cashierName, closedByName, deviceName }) => {
                const href = `/sessions/${session.id}`;
                return (
                  <TableRow
                    key={session.id}
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
                      session.force_closed && "bg-destructive/5"
                    )}
                  >
                    {showStoreColumn ? (
                      <TableCell className="font-medium">{storeName}</TableCell>
                    ) : null}
                    <TableCell className="font-medium text-primary">
                      {cashierName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {deviceName ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(session.opened_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {session.closed_at ? formatDateTime(session.closed_at) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(session.opening_cash)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {session.expected_cash != null
                        ? formatCurrency(session.expected_cash)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {session.actual_cash != null
                        ? formatCurrency(session.actual_cash)
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium tabular-nums",
                        session.variance != null &&
                          session.variance !== 0 &&
                          (session.variance > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-destructive")
                      )}
                    >
                      {session.variance != null
                        ? `${session.variance > 0 ? "+" : ""}${formatCurrency(session.variance)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.force_closed ? "destructive" : "secondary"}>
                        {session.force_closed ? "إغلاق إجباري" : "مقفولة"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                      {session.force_closed && session.close_reason ? (
                        <span>
                          {session.close_reason}
                          {closedByName ? (
                            <span className="block text-xs">بواسطة {closedByName}</span>
                          ) : null}
                        </span>
                      ) : session.notes ? (
                        session.notes
                      ) : (
                        "—"
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
