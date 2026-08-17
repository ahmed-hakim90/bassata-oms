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

export function treasuryEntryLabel(type: CashTreasuryEntryType): string {
  return ENTRY_LABELS[type] ?? type;
}
