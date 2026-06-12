"use client";

import { useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const collect = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    startTransition(async () => {
      try {
        await recordCustomerPaymentAction({
          customerId,
          amount: value,
          paymentMethod: method,
          reference,
        });
        setAmount("");
        setReference("");
        toast.success("Payment recorded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not record payment");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <OperationalCard title="Balance owed">
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(accountBalance)}</p>
        </OperationalCard>
        <OperationalCard title="Credit limit">
          <p className="text-2xl font-semibold tabular-nums">
            {creditLimit > 0 ? formatCurrency(creditLimit) : "No limit"}
          </p>
        </OperationalCard>
        <OperationalCard title="Payment terms">
          <p className="text-sm text-muted-foreground">{paymentTerms || "—"}</p>
        </OperationalCard>
      </div>

      {canCollect && accountBalance > 0 ? (
        <OperationalCard title="Receive payment">
          <div className="grid max-w-md gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter((m) => m !== "credit").map((m) => (
                    <SelectItem key={m} value={m} label={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <Button onClick={collect} disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </div>
        </OperationalCard>
      ) : null}

      {statement ? (
        <OperationalCard
          title="Account statement"
          action={
            <ExportButtonGroup
              printHref={`/print/statements/customers/${customerId}`}
              onExportExcel={() => {
                startTransition(async () => {
                  try {
                    const result = await exportCustomerStatementExcel(customerId);
                    downloadBase64Excel(result.base64, result.filename);
                    toast.success("Excel exported");
                  } catch {
                    toast.error("Export failed");
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
