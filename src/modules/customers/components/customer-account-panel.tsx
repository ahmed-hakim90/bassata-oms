"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { CustomerStatement, PaymentMethod } from "@/lib/types";
import { recordCustomerPaymentAction } from "@/modules/customers/actions/customer.actions";
import { ExportButtonGroup } from "@/modules/reports/components/export-button-group";
import { StatementTable } from "@/modules/reports/components/statement-table";
import { exportCustomerStatementExcel } from "@/modules/reports/actions/statement-report.actions";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";

interface CustomerAccountPanelProps {
  customerId: string;
  accountBalance: number;
  creditLimit: number;
  paymentTerms: string;
  statement: CustomerStatement | null;
  canCollect: boolean;
  currency?: string;
}

export function CustomerAccountPanel({
  customerId,
  accountBalance,
  creditLimit,
  paymentTerms,
  statement,
  canCollect,
  currency = "SAR",
}: CustomerAccountPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const collect = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("اكتب مبلغ صحيح");
      return;
    }
    if (value > accountBalance + 0.001) {
      toast.error("المبلغ أكبر من المستحق");
      return;
    }
    startTransition(async () => {
      try {
        const result = await recordCustomerPaymentAction({
          customerId,
          amount: value,
          paymentMethod: method,
          reference,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        setAmount("");
        setReference("");
        toast.success("تم تسجيل التحصيل");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر تسجيل التحصيل");
      }
    });
  };

  const collectValue = Number(amount);
  const amountTooHigh =
    Number.isFinite(collectValue) && collectValue > accountBalance + 0.001;

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]" dir="rtl">
      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <OperationalCard title="المستحق">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(accountBalance)}
          </p>
        </OperationalCard>
        <OperationalCard title="حد الائتمان">
          <p className="text-2xl font-semibold tabular-nums">
            {creditLimit > 0 ? formatCurrency(creditLimit) : "بدون حد"}
          </p>
        </OperationalCard>
        <OperationalCard title="شروط الدفع">
          <p className="text-sm text-muted-foreground">{paymentTerms || "—"}</p>
        </OperationalCard>
      </div>

      {canCollect && accountBalance > 0 ? (
        <OperationalCard title="تحصيل دفعة">
          <div className="grid max-w-md gap-[var(--mds-space-3)]">
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-collect-amount">المبلغ</Label>
              <Input
                id="customer-collect-amount"
                type="number"
                min="0"
                max={accountBalance}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-[var(--mds-radius-md)]"
              />
              {amountTooHigh ? (
                <p className="text-xs text-destructive">المبلغ أكبر من المستحق</p>
              ) : null}
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label>الطريقة</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="rounded-[var(--mds-radius-md)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                    <SelectItem key={m} value={m} label={m}>
                      {m === "cash"
                        ? "كاش"
                        : m === "card"
                          ? "كارت"
                          : m === "wallet"
                            ? "محفظة"
                            : "أخرى"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-[var(--mds-space-2)]">
              <Label htmlFor="customer-collect-ref">مرجع</Label>
              <Input
                id="customer-collect-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="rounded-[var(--mds-radius-md)]"
              />
            </div>
            <Button
              onClick={collect}
              disabled={pending || amountTooHigh}
              className="shadow-[var(--mds-elevation-1)]"
            >
              {pending ? "جاري الحفظ…" : "تسجيل التحصيل"}
            </Button>
          </div>
        </OperationalCard>
      ) : null}

      {statement ? (
        <OperationalCard
          title="كشف الحساب"
          action={
            <ExportButtonGroup
              printHref={`/print/statements/customers/${customerId}`}
              onExportExcel={() => {
                startTransition(async () => {
                  try {
                    const result = await exportCustomerStatementExcel(customerId);
                    downloadBase64Excel(result.base64, result.filename);
                    toast.success("تم تصدير Excel");
                  } catch {
                    toast.error("فشل التصدير");
                  }
                });
              }}
            />
          }
        >
          <StatementTable
            currency={currency}
            openingBalance={statement.openingBalance}
            closingBalance={statement.closingBalance}
            rows={statement.transactions.map((t) => ({
              id: t.id,
              date: t.at,
              type: t.type,
              reference: t.reference || t.description,
              debit: t.debit,
              credit: t.credit,
              balance: t.balance,
            }))}
          />
        </OperationalCard>
      ) : null}
    </div>
  );
}
