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
import { MobileEntityCard } from "@/components/SweetFlow/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/SweetFlow/responsive-list-layout";
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
  const periodLabel = hasDateFilter ? "الفترة" : "الكشف";

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <PageHeader
        breadcrumb={
          <span className="flex flex-wrap items-center gap-1">
            <Link href="/inventory/suppliers" className="text-primary hover:underline">
              الموردين
            </Link>
            <span aria-hidden>·</span>
            <Link href="/inventory/purchases" className="text-primary hover:underline">
              المشتريات
            </Link>
          </span>
        }
        title={supplier.name}
        description={supplier.contact_info || "كشف حساب المورد"}
        action={
          <div className="flex flex-wrap items-center gap-[var(--mds-space-2)]">
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

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="الرصيد المستحق"
          value={formatCurrency(kpis.balance, currency)}
          icon={<Landmark className="size-5" />}
        />
        <KpiCard
          label={`${periodLabel} — المشتريات`}
          value={formatCurrency(kpis.purchased, currency)}
        />
        <KpiCard
          label={`${periodLabel} — الدفعات`}
          value={formatCurrency(kpis.paid, currency)}
        />
        <KpiCard
          label="رصيد افتتاحي"
          value={formatCurrency(statement.openingBalance, currency)}
        />
      </div>

      <OperationalCard
        title="كشف الحساب"
        description={`الرصيد الختامي ${formatCurrency(statement.closingBalance, currency)}`}
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-[var(--mds-radius-md)] border border-border/60 bg-muted/30 p-3 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">من</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 w-full bg-background sm:h-9 sm:w-[9.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">إلى</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 w-full bg-background sm:h-9 sm:w-[9.5rem]"
            />
          </div>
          <Button size="sm" className="col-span-2 min-h-11 sm:col-auto sm:min-h-9" onClick={applyFilter} disabled={pending}>
            تطبيق
          </Button>
          {hasDateFilter ? (
            <Button size="sm" variant="outline" className="col-span-2 min-h-11 sm:col-auto sm:min-h-9" onClick={clearFilter} disabled={pending}>
              مسح
            </Button>
          ) : null}
          {from && !to ? (
            <p className="col-span-2 basis-full text-xs text-muted-foreground">
              تاريخ النهاية يكون اليوم تلقائيًا عند تحديد تاريخ البداية فقط.
            </p>
          ) : null}
        </div>
        <ResponsiveListLayout
          mobile={
            <>
              <MobileEntityCard
                title="رصيد افتتاحي"
                fields={[
                  {
                    label: "الرصيد",
                    value: (
                      <span className="font-medium tabular-nums">
                        {formatCurrency(statement.openingBalance, currency)}
                      </span>
                    ),
                  },
                ]}
              />
              {statement.transactions.length === 0 ? (
                <p className="rounded-[var(--mds-radius-md)] border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                  مفيش حركات في الفترة دي
                </p>
              ) : (
                statement.transactions.map((tx) => (
                  <MobileEntityCard
                    key={tx.id}
                    title={TYPE_LABELS[tx.type]}
                    subtitle={formatDateTime(tx.at)}
                    fields={[
                      {
                        label: "المرجع",
                        value: tx.purchaseInvoiceId ? (
                          <Link
                            href={`/inventory/purchases?invoice=${tx.purchaseInvoiceId}`}
                            className="font-medium text-primary"
                          >
                            {tx.reference}
                          </Link>
                        ) : (
                          tx.reference
                        ),
                      },
                      { label: "الوصف", value: tx.description || "—" },
                      {
                        label: "مدين",
                        value:
                          tx.debit > 0 ? (
                            <span className="tabular-nums">
                              {formatCurrency(tx.debit, currency)}
                            </span>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        label: "دائن",
                        value:
                          tx.credit > 0 ? (
                            <span className="tabular-nums">
                              {formatCurrency(tx.credit, currency)}
                            </span>
                          ) : (
                            "—"
                          ),
                      },
                      {
                        label: "الرصيد",
                        value: (
                          <span className="font-semibold tabular-nums">
                            {formatCurrency(tx.balance, currency)}
                          </span>
                        ),
                      },
                    ]}
                    footer={
                      canManagePayments && tx.type === "payment" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setVoidPaymentId(tx.id)}
                          disabled={pending}
                        >
                          إلغاء الدفعة
                        </Button>
                      ) : undefined
                    }
                  />
                ))
              )}
            </>
          }
          desktop={
            <div className="overflow-x-auto rounded-[var(--mds-radius-md)] border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="py-2 ps-4 font-medium">التاريخ</th>
                    <th className="py-2 ps-4 font-medium">النوع</th>
                    <th className="py-2 ps-4 font-medium">المرجع</th>
                    <th className="py-2 ps-4 font-medium">الوصف</th>
                    <th className="py-2 ps-4 text-end font-medium">مدين</th>
                    <th className="py-2 ps-4 text-end font-medium">دائن</th>
                    <th className="py-2 text-end font-medium">الرصيد</th>
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
                    <td className="py-2 text-end font-medium tabular-nums">
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
                      <tr key={t.id} className="border-b border-border/40">
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
          }
        />
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
            refreshStatement(statementRange(from, to));
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
    </div>
  );
}
