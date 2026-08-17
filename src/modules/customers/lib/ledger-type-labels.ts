import type { CustomerLedgerEntryType } from "@/lib/types";

export const CUSTOMER_LEDGER_TYPE_LABELS: Record<CustomerLedgerEntryType, string> = {
  credit_sale: "بيع آجل",
  payment_received: "تحصيل",
  refund: "مرتجع",
  adjustment: "تسوية",
};

export function customerLedgerDisplayLabel(input: {
  type: CustomerLedgerEntryType;
  paymentId?: string | null;
  debit: number;
}): string {
  if (input.type === "adjustment" && input.paymentId && input.debit > 0) {
    return "إلغاء تحصيل";
  }
  return CUSTOMER_LEDGER_TYPE_LABELS[input.type] ?? input.type;
}
