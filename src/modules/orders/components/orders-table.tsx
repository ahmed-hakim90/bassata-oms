"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/lib/types";

const columnHelper = createColumnHelper<Order & { storeName: string }>();

const columns = [
  columnHelper.accessor("order_number", {
    header: "Order",
    cell: (info) => (
      <Link
        href={`/orders/${info.row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("storeName", { header: "Store" }),
  columnHelper.accessor("created_at", {
    header: "Date",
    cell: (info) => format(new Date(info.getValue()), "MMM d, h:mm a"),
  }),
  columnHelper.accessor("total", {
    header: "Total",
    cell: (info) => (
      <span className="tabular-nums font-medium">
        {formatCurrency(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      return (
        <Badge
          variant={
            status === "completed"
              ? "secondary"
              : status === "voided"
                ? "destructive"
                : "outline"
          }
        >
          {status}
        </Badge>
      );
    },
  }),
  columnHelper.accessor("payment_status", {
    header: "Payment",
    cell: (info) => {
      const status = info.getValue();
      return (
        <Badge
          variant={
            status === "paid" ? "secondary" : status === "unpaid" ? "outline" : "default"
          }
        >
          {status}
        </Badge>
      );
    },
  }),
];

interface OrdersTableProps {
  orders: (Order & { storeName: string })[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No orders yet
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="h-14">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
