import { roundMoney } from "@/lib/money";
import type { GlSystemKey, PaymentMethod } from "@/lib/types";

export type BuiltGlLine = {
  systemKey: GlSystemKey;
  debit: number;
  credit: number;
  memo?: string;
};

export function paymentMethodToSystemKey(method: PaymentMethod): GlSystemKey {
  switch (method) {
    case "cash":
      return "cash";
    case "card":
      return "card";
    case "wallet":
      return "wallet";
    case "credit":
      return "ar";
    case "other":
    default:
      return "other_payment";
  }
}

/**
 * Build sale journal line amounts (system keys only — account IDs resolved later).
 * Debits: payments + discount; Credits: revenue + tax; optional COGS/inventory.
 */
export function buildSaleJournalLines(input: {
  total: number;
  tax: number;
  discount: number;
  payments: { method: PaymentMethod; amount: number }[];
  cogs?: number;
}): BuiltGlLine[] {
  const total = roundMoney(input.total);
  const tax = roundMoney(Math.max(0, input.tax));
  const discount = roundMoney(Math.max(0, input.discount));
  const cogs = roundMoney(Math.max(0, input.cogs ?? 0));
  const revenue = roundMoney(total - tax + discount);

  const lines: BuiltGlLine[] = [];
  const paymentTotals = new Map<GlSystemKey, number>();

  for (const payment of input.payments) {
    const amount = roundMoney(payment.amount);
    if (amount <= 0) continue;
    const key = paymentMethodToSystemKey(payment.method);
    paymentTotals.set(key, roundMoney((paymentTotals.get(key) ?? 0) + amount));
  }

  for (const [systemKey, amount] of paymentTotals) {
    lines.push({ systemKey, debit: amount, credit: 0 });
  }

  if (discount > 0) {
    lines.push({ systemKey: "sales_discount", debit: discount, credit: 0 });
  }
  if (revenue > 0) {
    lines.push({ systemKey: "sales_revenue", debit: 0, credit: revenue });
  }
  if (tax > 0) {
    lines.push({ systemKey: "tax_payable", debit: 0, credit: tax });
  }
  if (cogs > 0) {
    lines.push({ systemKey: "cogs", debit: cogs, credit: 0 });
    lines.push({ systemKey: "inventory", debit: 0, credit: cogs });
  }

  return lines.filter((line) => line.debit > 0 || line.credit > 0);
}

export function buildExpenseJournalLines(input: {
  amount: number;
  paymentMethod: PaymentMethod;
}): BuiltGlLine[] {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return [];
  return [
    { systemKey: "expense_default", debit: amount, credit: 0 },
    {
      systemKey: paymentMethodToSystemKey(input.paymentMethod),
      debit: 0,
      credit: amount,
    },
  ];
}

export function buildPurchaseJournalLines(input: {
  total: number;
  amountPaid: number;
  paymentMethod?: PaymentMethod;
}): BuiltGlLine[] {
  const total = roundMoney(input.total);
  const paid = roundMoney(Math.min(Math.max(0, input.amountPaid), total));
  const remainder = roundMoney(total - paid);
  if (total <= 0) return [];

  const lines: BuiltGlLine[] = [
    { systemKey: "inventory", debit: total, credit: 0 },
  ];
  if (paid > 0) {
    lines.push({
      systemKey: paymentMethodToSystemKey(input.paymentMethod ?? "cash"),
      debit: 0,
      credit: paid,
    });
  }
  if (remainder > 0) {
    lines.push({ systemKey: "ap", debit: 0, credit: remainder });
  }
  return lines;
}

export function buildCustomerPaymentJournalLines(input: {
  amount: number;
  paymentMethod: PaymentMethod;
}): BuiltGlLine[] {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return [];
  return [
    {
      systemKey: paymentMethodToSystemKey(input.paymentMethod),
      debit: amount,
      credit: 0,
    },
    { systemKey: "ar", debit: 0, credit: amount },
  ];
}

export function buildSupplierPaymentJournalLines(input: {
  amount: number;
  paymentMethod: PaymentMethod;
}): BuiltGlLine[] {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return [];
  return [
    { systemKey: "ap", debit: amount, credit: 0 },
    {
      systemKey: paymentMethodToSystemKey(input.paymentMethod),
      debit: 0,
      credit: amount,
    },
  ];
}

/** Dr waste / Cr inventory */
export function buildWasteJournalLines(input: { cost: number }): BuiltGlLine[] {
  const cost = roundMoney(Math.max(0, input.cost));
  if (cost <= 0) return [];
  return [
    { systemKey: "waste", debit: cost, credit: 0 },
    { systemKey: "inventory", debit: 0, credit: cost },
  ];
}

/** Flip debit/credit for reversing an auto-posted sale (when original JE missing). */
export function reverseBuiltLines(lines: BuiltGlLine[]): BuiltGlLine[] {
  return lines
    .map((line) => ({
      systemKey: line.systemKey,
      debit: line.credit,
      credit: line.debit,
      memo: line.memo,
    }))
    .filter((line) => line.debit > 0 || line.credit > 0);
}
