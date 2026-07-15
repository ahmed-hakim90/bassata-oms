"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { DataTableShell } from "@/components/SweetFlow/data-table-shell";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { MobileEntityCard } from "@/components/SweetFlow/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/SweetFlow/responsive-list-layout";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderDetailDialog } from "@/modules/orders/components/order-detail-dialog";
import type { SessionInvoiceRow } from "@/modules/sessions/services/session-detail.service";

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface SessionInvoicesTableProps {
  invoices: SessionInvoiceRow[];
}

export function SessionInvoicesTable({ invoices }: SessionInvoicesTableProps) {
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((invoice) => {
      const customer = invoice.customerName?.toLowerCase() ?? "";
      const walkIn = "بدون عميل";
      return (
        invoice.order_number.toLowerCase().includes(q) ||
        customer.includes(q) ||
        (!invoice.hasCustomer && walkIn.includes(q)) ||
        (STATUS_LABELS[invoice.status] ?? invoice.status).includes(q)
      );
    });
  }, [invoices, query]);

  if (invoices.length === 0) {
    return (
      <EmptyStateBlock
        title="مفيش فواتير في الجلسة دي"
        description="لما تتسجل مبيعات من نقطة البيع على الجلسة دي، هتظهر هنا."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--mds-space-3)]">
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث برقم الفاتورة أو اسم العميل…"
          aria-label="بحث في فواتير الجلسة"
          className="h-11 rounded-[var(--mds-radius-md)] border-border/70 bg-background ps-10 md:h-10"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyStateBlock
          title="لا نتائج"
          description="جرّب رقم فاتورة أو اسم عميل مختلف."
        />
      ) : (
        <ResponsiveListLayout
          mobile={filtered.map((invoice) => (
            <MobileEntityCard
              key={invoice.id}
              onClick={() => setSelectedOrderId(invoice.id)}
              title={invoice.order_number}
              badge={
                <Badge
                  variant={
                    invoice.status === "completed"
                      ? "secondary"
                      : invoice.status === "voided" || invoice.status === "refunded"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {STATUS_LABELS[invoice.status] ?? invoice.status}
                </Badge>
              }
              fields={[
                { label: "الوقت", value: formatDateTime(invoice.created_at) },
                {
                  label: "القيمة",
                  value: (
                    <span className="font-medium tabular-nums">
                      {formatCurrency(invoice.total)}
                    </span>
                  ),
                },
                {
                  label: "العميل",
                  value: (
                    <span className={cn(!invoice.hasCustomer && "text-muted-foreground")}>
                      {invoice.hasCustomer
                        ? (invoice.customerName ?? "عميل")
                        : "بدون عميل"}
                    </span>
                  ),
                },
                {
                  label: "الدفع",
                  value:
                    PAYMENT_STATUS_LABELS[invoice.payment_status] ??
                    invoice.payment_status,
                },
              ]}
            />
          ))}
          desktop={
            <DataTableShell title={`فواتير الجلسة (${filtered.length})`}>
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      رقم الفاتورة
                    </TableHead>
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      الوقت
                    </TableHead>
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      القيمة
                    </TableHead>
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      العميل
                    </TableHead>
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      الحالة
                    </TableHead>
                    <TableHead className="h-10 text-xs font-semibold text-muted-foreground">
                      الدفع
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() => setSelectedOrderId(invoice.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedOrderId(invoice.id);
                        }
                      }}
                    >
                      <TableCell>
                        <span className="font-medium text-primary">
                          {invoice.order_number}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(invoice.created_at)}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          !invoice.hasCustomer && "text-muted-foreground"
                        )}
                        onClick={(e) => {
                          if (invoice.hasCustomer && invoice.customer_id) {
                            e.stopPropagation();
                          }
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {invoice.hasCustomer ? (
                          invoice.customerName && invoice.customer_id ? (
                            <Link
                              href={`/customers/${invoice.customer_id}`}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {invoice.customerName}
                            </Link>
                          ) : (
                            "عميل"
                          )
                        ) : (
                          "بدون عميل"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "completed"
                              ? "secondary"
                              : invoice.status === "voided" ||
                                  invoice.status === "refunded"
                                ? "destructive"
                                : "outline"
                          }
                          className={cn(
                            invoice.status === "completed" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                          )}
                        >
                          {STATUS_LABELS[invoice.status] ?? invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.payment_status === "paid"
                              ? "secondary"
                              : invoice.payment_status === "unpaid"
                                ? "outline"
                                : "default"
                          }
                          className={cn(
                            invoice.payment_status === "paid" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
                            invoice.payment_status === "unpaid" &&
                              "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                          )}
                        >
                          {PAYMENT_STATUS_LABELS[invoice.payment_status] ??
                            invoice.payment_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableShell>
          }
        />
      )}

      <OrderDetailDialog
        orderId={selectedOrderId}
        open={Boolean(selectedOrderId)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
      />
    </div>
  );
}
