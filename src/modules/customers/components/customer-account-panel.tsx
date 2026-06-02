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
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { CustomerStatement, PaymentMethod } from "@/lib/types";
import { recordCustomerPaymentAction } from "@/modules/customers/actions/customer.actions";

interface CustomerAccountPanelProps {
  customerId: string;
  accountBalance: number;
  creditLimit: number;
  paymentTerms: string;
  statement: CustomerStatement | null;
  canCollect: boolean;
}

export function CustomerAccountPanel({
  customerId,
  accountBalance,
  creditLimit,
  paymentTerms,
  statement,
  canCollect,
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
        <OperationalCard title="Account statement">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 pr-4 text-right">Credit</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted-foreground">
                      No account activity yet
                    </td>
                  </tr>
                ) : (
                  statement.transactions.map((t) => (
                    <tr key={t.id} className="border-b border-border/40">
                      <td className="py-2 pr-4">{formatDateTime(t.at)}</td>
                      <td className="py-2 pr-4">{t.type}</td>
                      <td className="py-2 pr-4">{t.reference}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {t.debit > 0 ? formatCurrency(t.debit) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {t.credit > 0 ? formatCurrency(t.credit) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {formatCurrency(t.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </OperationalCard>
      ) : null}
    </div>
  );
}
