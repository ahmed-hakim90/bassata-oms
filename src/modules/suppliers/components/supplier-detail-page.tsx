"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { KpiCard } from "@/components/SweetFlow/kpi-card";
import { StatusPill } from "@/components/SweetFlow/status-pill";
import { ConfirmActionDialog } from "@/components/SweetFlow/confirm-action-dialog";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { exportSupplierStatementExcel } from "@/modules/reports/actions/statement-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { SupplierStatement, SupplierStatementTransactionType } from "@/lib/types";
import {
  getSupplierStatementAction,
  voidSupplierPaymentAction,
} from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { EditSupplierDialog } from "./edit-supplier-dialog";

const TYPE_LABELS: Record<SupplierStatementTransactionType, string> = {
  purchase: "Purchase",
  purchase_void: "Invoice void",
  payment: "Payment",
  payment_void: "Payment void",
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function statementRange(from: string, to: string): { from?: string; to?: string } {
  return {
    from: from || undefined,
    to: to || (from ? todayDateString() : undefined),
  };
}

interface SupplierDetailPageProps {
  initialStatement: SupplierStatement;
  currency: string;
  canManagePayments: boolean;
  canEditSupplier: boolean;
  storeId: string;
}

export function SupplierDetailPage({
  initialStatement,
  currency,
  canManagePayments,
  canEditSupplier,
  storeId,
}: SupplierDetailPageProps) {
  const router = useRouter();
  const [statement, setStatement] = useState(initialStatement);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasDateFilter = Boolean(from || to);
  const kpiScope = hasDateFilter ? "Period" : "Statement";

  const refreshStatement = (range?: { from?: string; to?: string }) => {
    startTransition(async () => {
      const result = await getSupplierStatementAction(statement.supplier.id, range);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStatement(result.data);
    });
  };

  const kpis = useMemo(() => {
    const purchased = statement.transactions
      .filter((t) => t.type === "purchase")
      .reduce((s, t) => s + t.debit, 0);
    const paid = statement.transactions
      .filter((t) => t.type === "payment")
      .reduce((s, t) => s + t.credit, 0);
    return { purchased, paid, balance: statement.closingBalance };
  }, [statement]);

  const applyFilter = () => {
    refreshStatement(statementRange(from, to));
  };

  const clearFilter = () => {
    setFrom("");
    setTo("");
    refreshStatement();
  };

  const confirmVoidPayment = () => {
    if (!voidPaymentId) return;
    startTransition(async () => {
      const result = await voidSupplierPaymentAction(
        voidPaymentId,
        statement.supplier.id
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment voided");
      setVoidPaymentId(null);
      router.refresh();
      refreshStatement(statementRange(from, to));
    });
  };

  const printQs = new URLSearchParams();
  if (from) printQs.set("from", from);
  if (to) printQs.set("to", to);
  const printHref = `/print/statements/suppliers/${statement.supplier.id}${
    printQs.toString() ? `?${printQs}` : ""
  }`;

  const { supplier } = statement;

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={supplier.contact_info || "Supplier account statement"}
        action={
          <div className="flex flex-wrap gap-2">
            {canEditSupplier ? (
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
            ) : null}
            {canManagePayments ? (
              <Button onClick={() => setShowPayment(true)}>
                <Plus className="size-4" /> Record Payment
              </Button>
            ) : null}
            <ExportButtonGroup
              printHref={printHref}
              onExportExcel={() => {
                startTransition(async () => {
                  try {
                    const result = await exportSupplierStatementExcel(
                      statement.supplier.id,
                      storeId,
                      statementRange(from, to)
                    );
                    downloadBase64Excel(result.base64, result.filename);
                    toast.success("Excel exported");
                  } catch {
                    toast.error("Export failed");
                  }
                });
              }}
            />
          </div>
        }
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/inventory/suppliers" className="text-primary hover:underline">
          ← All suppliers
        </Link>
        {" · "}
        <Link href="/inventory/purchases" className="text-primary hover:underline">
          Purchases
        </Link>
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Balance due"
          value={formatCurrency(kpis.balance, currency)}
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label={`${kpiScope} purchases`}
          value={formatCurrency(kpis.purchased, currency)}
        />
        <KpiCard label={`${kpiScope} payments`} value={formatCurrency(kpis.paid, currency)} />
        <KpiCard
          label="Opening balance"
          value={formatCurrency(statement.openingBalance, currency)}
        />
      </div>

      <OperationalCard title="Date range" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={from ? "Defaults to today" : undefined}
            />
          </div>
          <Button onClick={applyFilter} disabled={pending}>
            Apply
          </Button>
          <Button variant="outline" onClick={clearFilter} disabled={pending}>
            Clear
          </Button>
        </div>
        {from && !to ? (
          <p className="mt-2 text-xs text-muted-foreground">
            End date defaults to today when only From is set.
          </p>
        ) : null}
      </OperationalCard>

      <OperationalCard
        title="Account statement"
        description={`Closing balance ${formatCurrency(statement.closingBalance, currency)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4 text-right">Debit</th>
                <th className="py-2 pr-4 text-right">Credit</th>
                <th className="py-2 text-right">Balance</th>
                {canManagePayments ? <th className="py-2 pl-2" /> : null}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="py-2 pr-4 text-muted-foreground" colSpan={4}>
                  Opening balance
                </td>
                <td className="py-2 pr-4 text-right" />
                <td className="py-2 pr-4 text-right" />
                <td className="py-2 text-right font-medium">
                  {formatCurrency(statement.openingBalance, currency)}
                </td>
                {canManagePayments ? <td /> : null}
              </tr>
              {statement.transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManagePayments ? 8 : 7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No transactions in this period
                  </td>
                </tr>
              ) : (
                statement.transactions.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(t.at)}</td>
                    <td className="py-2 pr-4">
                      <StatusPill
                        label={TYPE_LABELS[t.type]}
                        variant={
                          t.type === "purchase"
                            ? "success"
                            : t.type === "payment"
                              ? "info"
                              : "danger"
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {t.purchaseInvoiceId ? (
                        <Link
                          href={`/inventory/purchases?invoice=${t.purchaseInvoiceId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {t.reference}
                        </Link>
                      ) : (
                        t.reference
                      )}
                    </td>
                    <td className="py-2 pr-4">{t.description}</td>
                    <td className="py-2 pr-4 text-right">
                      {t.debit > 0 ? formatCurrency(t.debit, currency) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {t.credit > 0 ? formatCurrency(t.credit, currency) : "—"}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {formatCurrency(t.balance, currency)}
                    </td>
                    {canManagePayments && t.type === "payment" ? (
                      <td className="py-2 pl-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setVoidPaymentId(t.id)}
                          disabled={pending}
                        >
                          Void
                        </Button>
                      </td>
                    ) : canManagePayments ? (
                      <td />
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </OperationalCard>

      {canManagePayments ? (
        <RecordPaymentDialog
          supplierId={supplier.id}
          open={showPayment}
          onOpenChange={setShowPayment}
          onSuccess={() => {
            router.refresh();
            refreshStatement(statementRange(from, to));
          }}
        />
      ) : null}

      {canEditSupplier ? (
        <EditSupplierDialog
          supplier={supplier}
          open={showEdit}
          onOpenChange={setShowEdit}
          onSuccess={(updated) => {
            setStatement((prev) => ({
              ...prev,
              supplier: updated,
            }));
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={voidPaymentId !== null}
        onOpenChange={(open) => !open && setVoidPaymentId(null)}
        title="Void payment"
        description="This reverses the payment on the supplier statement. The payment row will remain as a void entry."
        confirmLabel="Void payment"
        destructive
        onConfirm={confirmVoidPayment}
      />
    </>
  );
}
