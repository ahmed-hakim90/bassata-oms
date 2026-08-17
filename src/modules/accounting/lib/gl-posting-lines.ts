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

/**
 * Session till variance (actual − expected).
 * Shortage: Dr cash_over_short / Cr cash. Overage: Dr cash / Cr cash_over_short.
 */
export function buildSessionVarianceJournalLines(input: {
  variance: number;
}): BuiltGlLine[] {
  const variance = roundMoney(input.variance);
  if (variance === 0) return [];
  if (variance < 0) {
    const shortage = roundMoney(-variance);
    return [
      { systemKey: "cash_over_short", debit: shortage, credit: 0 },
      { systemKey: "cash", debit: 0, credit: shortage },
    ];
  }
  return [
    { systemKey: "cash", debit: variance, credit: 0 },
    { systemKey: "cash_over_short", debit: 0, credit: variance },
  ];
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

/** Capitalize customs/port costs onto inventory (EGP). Unpaid → AP. */
export function buildCustomsCertificateJournalLines(input: {
  amount: number;
  paymentMethod?: PaymentMethod | null;
}): BuiltGlLine[] {
  const amount = roundMoney(Math.max(0, input.amount));
  if (amount <= 0) return [];
  const creditKey = input.paymentMethod
    ? paymentMethodToSystemKey(input.paymentMethod)
    : "ap";
  return [
    { systemKey: "inventory", debit: amount, credit: 0 },
    { systemKey: creditKey, debit: 0, credit: amount },
  ];
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

/** Dr AP / Cr inventory — reduces what we owe the supplier. */
export function buildPurchaseReturnJournalLines(input: {
  total: number;
}): BuiltGlLine[] {
  const total = roundMoney(Math.max(0, input.total));
  if (total <= 0) return [];
  return [
    { systemKey: "ap", debit: total, credit: 0 },
    { systemKey: "inventory", debit: 0, credit: total },
  ];
}

/**
 * Stock-count net value: positive = overage (Dr inventory / Cr waste),
 * negative = shortage (Dr waste / Cr inventory). Uses the waste account
 * already in the default CoA — no new system key.
 */
export function buildStockCountJournalLines(input: {
  inventoryDeltaValue: number;
}): BuiltGlLine[] {
  const value = roundMoney(input.inventoryDeltaValue);
  if (value === 0) return [];
  if (value > 0) {
    return [
      { systemKey: "inventory", debit: value, credit: 0 },
      { systemKey: "waste", debit: 0, credit: value },
    ];
  }
  const shortage = roundMoney(-value);
  return [
    { systemKey: "waste", debit: shortage, credit: 0 },
    { systemKey: "inventory", debit: 0, credit: shortage },
  ];
}

/**
 * Move extra (or reduced) COGS after a delivered-invoice cost correction.
 * Positive delta: Dr cogs / Cr inventory. Negative: the opposite.
 */
export function buildCogsAdjustmentJournalLines(input: {
  cogsDelta: number;
}): BuiltGlLine[] {
  const delta = roundMoney(input.cogsDelta);
  if (delta === 0) return [];
  if (delta > 0) {
    return [
      { systemKey: "cogs", debit: delta, credit: 0 },
      { systemKey: "inventory", debit: 0, credit: delta },
    ];
  }
  const creditCogs = roundMoney(-delta);
  return [
    { systemKey: "inventory", debit: creditCogs, credit: 0 },
    { systemKey: "cogs", debit: 0, credit: creditCogs },
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
