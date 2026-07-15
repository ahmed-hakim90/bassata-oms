"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { MobileEntityCard } from "@/components/SweetFlow/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/SweetFlow/responsive-list-layout";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

const columnHelper = createColumnHelper<Order & { storeName: string }>();

const STATUS_LABELS: Record<string, string> = {
  completed: "مكتمل",
  voided: "ملغي",
  refunded: "مسترد",
  pending: "قيد الانتظار",
  open: "مفتوح",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "مدفوع",
  unpaid: "غير مدفوع",
  partial: "جزئي",
  refunded: "مسترد",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "completed"
          ? "secondary"
          : status === "voided" || status === "refunded"
            ? "destructive"
            : "outline"
      }
      className={cn(
        status === "completed" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={status === "paid" ? "secondary" : status === "unpaid" ? "outline" : "default"}
      className={cn(
        status === "paid" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
        status === "unpaid" &&
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      )}
    >
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const columns = [
  columnHelper.accessor("order_number", {
    header: "رقم الطلب",
    cell: (info) => (
      <Link
        href={`/orders/${info.row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("storeName", { header: "الفرع" }),
  columnHelper.accessor("created_at", {
    header: "التاريخ",
    cell: (info) =>
      new Date(info.getValue()).toLocaleString("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
  }),
  columnHelper.accessor("total", {
    header: "الإجمالي",
    cell: (info) => (
      <span className="font-medium tabular-nums">{formatCurrency(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "الحالة",
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor("payment_status", {
    header: "الدفع",
    cell: (info) => <PaymentBadge status={info.getValue()} />,
  }),
];

interface OrdersTableProps {
  orders: (Order & { storeName: string })[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(q) ||
        order.storeName.toLowerCase().includes(q) ||
        order.status.toLowerCase().includes(q) ||
        (STATUS_LABELS[order.status] ?? "").includes(q)
    );
  }, [orders, query]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث برقم الطلب أو الفرع…"
          aria-label="بحث في الطلبات"
          className="h-11 rounded-[var(--mds-radius-md)] border-border/70 bg-background ps-10 md:h-10"
        />
      </div>
      {rows.length === 0 ? (
        <EmptyStateBlock
          title={query.trim() ? "لا نتائج" : "لا توجد طلبات"}
          description={
            query.trim()
              ? "جرّب رقم طلب أو فرع مختلف."
              : "لما تتعمل طلبات من نقطة البيع، هتظهر هنا."
          }
        />
      ) : (
        <ResponsiveListLayout
          mobile={rows.map((row) => {
            const order = row.original;
            return (
              <MobileEntityCard
                key={order.id}
                href={`/orders/${order.id}`}
                title={order.order_number}
                subtitle={order.storeName}
                badge={<StatusBadge status={order.status} />}
                fields={[
                  {
                    label: "التاريخ",
                    value: new Date(order.created_at).toLocaleString("ar-EG", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  },
                  {
                    label: "الإجمالي",
                    value: (
                      <span className="tabular-nums">{formatCurrency(order.total)}</span>
                    ),
                  },
                  {
                    label: "الدفع",
                    value: <PaymentBadge status={order.payment_status} />,
                  },
                ]}
                trailingHint="فتح الطلب ←"
              />
            );
          })}
          desktop={
            <div className="overflow-hidden rounded-[var(--mds-radius-lg)] border border-border bg-card text-card-foreground shadow-[var(--mds-elevation-1)]">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent">
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="h-10 text-xs font-semibold text-muted-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          }
        />
      )}
    </div>
  );
}
