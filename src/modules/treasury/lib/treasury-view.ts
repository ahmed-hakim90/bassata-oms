import type {
  CashTreasury,
  CashTreasuryEntryType,
  CashTreasuryLedgerEntry,
  MonthlyClose,
} from "@/lib/types";

export type TreasurySummary = CashTreasury & {
  label: string;
  storeName: string | null;
};

export type TreasuryPageData = {
  treasuries: TreasurySummary[];
  ledger: CashTreasuryLedgerEntry[];
  closedPeriods: Array<MonthlyClose & { storeName: string | null }>;
};

const ENTRY_LABELS: Record<CashTreasuryEntryType, string> = {
  transfer_out: "تحويل خارج",
  transfer_in: "تحويل داخل",
  cashier_collect: "توريد من أمانة كاشير",
  expense_payout: "صرف مصروف",
  collection_deposit: "تحصيل عميل",
  supplier_payout: "سداد مورد",
  period_sweep: "سحب فترة",
};

export function treasuryEntryLabel(type: CashTreasuryEntryType, amount?: number): string {
  if (amount != null) {
    if (type === "supplier_payout" && amount > 0) return "عكس سداد مورد";
    if (type === "expense_payout" && amount > 0) return "عكس صرف مصروف";
    if (type === "collection_deposit" && amount < 0) return "عكس تحصيل عميل";
  }
  return ENTRY_LABELS[type] ?? type;
}
