import type { CustomerLedgerEntryType } from "@/lib/types";

export const CUSTOMER_LEDGER_TYPE_LABELS: Record<CustomerLedgerEntryType, string> = {
  credit_sale: "بيع آجل",
  payment_received: "تحصيل",
  refund: "مرتجع",
  adjustment: "تسوية",
};
