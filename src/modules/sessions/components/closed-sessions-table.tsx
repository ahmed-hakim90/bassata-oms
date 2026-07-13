"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-[var(--mds-space-3)]">
      <div className="grid gap-[var(--mds-space-3)] md:hidden">
        {rows.map(({ session, storeName, cashierName, closedByName }) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="rounded-[var(--mds-radius-md)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)] outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium text-primary">{cashierName}</p>
              <Badge variant={session.force_closed ? "destructive" : "secondary"}>
                {session.force_closed ? "إغلاق إجباري" : "مقفولة"}
              </Badge>
            </div>
            {showStoreColumn ? (
              <p className="mb-2 text-xs text-muted-foreground">{storeName}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="text-muted-foreground">الفتح</p>
              <p>{formatDateTime(session.opened_at)}</p>
              <p className="text-muted-foreground">الإغلاق</p>
              <p>{session.closed_at ? formatDateTime(session.closed_at) : "—"}</p>
              <p className="text-muted-foreground">المتوقع</p>
              <p>
                {session.expected_cash != null
                  ? formatCurrency(session.expected_cash)
                  : "—"}
              </p>
              <p className="text-muted-foreground">الفعلي</p>
              <p>
                {session.actual_cash != null
                  ? formatCurrency(session.actual_cash)
                  : "—"}
              </p>
              <p className="text-muted-foreground">فرق الدرج</p>
              <p
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
              </p>
            </div>
            {session.force_closed && session.close_reason ? (
              <p className="mt-2 text-xs text-destructive">
                السبب: {session.close_reason}
                {closedByName ? ` · بواسطة ${closedByName}` : ""}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-primary">عرض الفواتير ←</p>
          </Link>
        ))}
      </div>

      <div className="hidden md:block">
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
      </div>
    </div>
  );
}
