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
  purchase: "شراء",
  purchase_void: "إلغاء فاتورة",
  payment: "دفعة",
  payment_void: "إلغاء دفعة",
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
      toast.success("تم إلغاء الدفعة");
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
        description={supplier.contact_info || "كشف حساب المورد"}
        action={
          <div className="flex flex-wrap gap-2">
            {canEditSupplier ? (
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                <Pencil className="size-4" /> تعديل
              </Button>
            ) : null}
            {canManagePayments ? (
              <Button onClick={() => setShowPayment(true)}>
                <Plus className="size-4" /> تسجيل دفعة
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
                    toast.success("تم تصدير Excel");
                  } catch {
                    toast.error("فشل التصدير");
                  }
                });
              }}
            />
          </div>
        }
      />

      <p className="mb-[var(--mds-space-4)] text-sm text-muted-foreground">
        <Link href="/inventory/suppliers" className="text-primary hover:underline">
          كل الموردين →
        </Link>
        {" · "}
        <Link href="/inventory/purchases" className="text-primary hover:underline">
          المشتريات
        </Link>
      </p>

      <div className="mb-[var(--mds-space-6)] grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="الرصيد المستحق"
          value={formatCurrency(kpis.balance, currency)}
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label={`${hasDateFilter ? "الفترة" : "الكشف"} - المشتريات`}
          value={formatCurrency(kpis.purchased, currency)}
        />
        <KpiCard label={`${hasDateFilter ? "الفترة" : "الكشف"} - الدفعات`} value={formatCurrency(kpis.paid, currency)} />
        <KpiCard
          label="رصيد افتتاحي"
          value={formatCurrency(statement.openingBalance, currency)}
        />
      </div>

      <OperationalCard title="نطاق التاريخ" className="mb-[var(--mds-space-6)]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>من</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>إلى</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={from ? "الافتراضي اليوم" : undefined}
            />
          </div>
          <Button onClick={applyFilter} disabled={pending}>
            تطبيق
          </Button>
          <Button variant="outline" onClick={clearFilter} disabled={pending}>
            مسح
          </Button>
        </div>
        {from && !to ? (
          <p className="mt-2 text-xs text-muted-foreground">
            تاريخ النهاية يكون اليوم تلقائيًا عند تحديد تاريخ البداية فقط.
          </p>
        ) : null}
      </OperationalCard>

      <OperationalCard
        title="كشف الحساب"
        description={`الرصيد الختامي ${formatCurrency(statement.closingBalance, currency)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-start text-muted-foreground">
                <th className="py-2 ps-4">التاريخ</th>
                <th className="py-2 ps-4">النوع</th>
                <th className="py-2 ps-4">المرجع</th>
                <th className="py-2 ps-4">الوصف</th>
                <th className="py-2 ps-4 text-end">مدين</th>
                <th className="py-2 ps-4 text-end">دائن</th>
                <th className="py-2 text-end">الرصيد</th>
                {canManagePayments ? <th className="py-2 pe-2" /> : null}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="py-2 ps-4 text-muted-foreground" colSpan={4}>
                  رصيد افتتاحي
                </td>
                <td className="py-2 ps-4 text-end" />
                <td className="py-2 ps-4 text-end" />
                <td className="py-2 text-end font-medium">
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
                    مفيش حركات في الفترة دي
                  </td>
                </tr>
              ) : (
                  statement.transactions.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="whitespace-nowrap py-2 ps-4">{formatDateTime(t.at)}</td>
                    <td className="py-2 ps-4">
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
                    <td className="py-2 ps-4">
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
                    <td className="py-2 ps-4">{t.description}</td>
                    <td className="py-2 ps-4 text-end tabular-nums">
                      {t.debit > 0 ? formatCurrency(t.debit, currency) : "—"}
                    </td>
                    <td className="py-2 ps-4 text-end tabular-nums">
                      {t.credit > 0 ? formatCurrency(t.credit, currency) : "—"}
                    </td>
                    <td className="py-2 text-end font-medium tabular-nums">
                      {formatCurrency(t.balance, currency)}
                    </td>
                    {canManagePayments && t.type === "payment" ? (
                      <td className="py-2 pe-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setVoidPaymentId(t.id)}
                          disabled={pending}
                        >
                          إلغاء
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
        title="إلغاء الدفعة"
        description="سيتم عكس الدفعة في كشف حساب المورد وسيبقى سطر الدفعة كحركة ملغية."
        confirmLabel="إلغاء الدفعة"
        destructive
        onConfirm={confirmVoidPayment}
      />
    </>
  );
}
