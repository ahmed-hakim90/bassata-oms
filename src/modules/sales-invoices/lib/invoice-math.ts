import { roundMoney } from "@/lib/money";

export type InvoiceLineForTotals = {
  line_total: number;
};

export function invoiceLineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

export function computeInvoiceTotals(input: {
  lines: InvoiceLineForTotals[];
  discount: number;
  taxRate: number;
}): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = roundMoney(input.lines.reduce((sum, line) => sum + line.line_total, 0));
  const discount = Math.max(0, input.discount);
  const tax = roundMoney(Math.max(0, subtotal - discount) * input.taxRate);
  const total = roundMoney(Math.max(0, subtotal - discount + tax));
  return { subtotal, discount, tax, total };
}
