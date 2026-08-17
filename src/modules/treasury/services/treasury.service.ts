import * as treasuryRepo from "@/lib/repositories/cash-treasury.repository";
import * as closingRepo from "@/lib/repositories/closing.repository";
import { listStores } from "@/lib/repositories/store.repository";
import { roundMoney } from "@/lib/money";
import type { CashTreasuryEntryType } from "@/lib/types";
import type { TreasuryPageData, TreasurySummary } from "@/modules/treasury/lib/treasury-view";

export type { TreasuryPageData, TreasurySummary } from "@/modules/treasury/lib/treasury-view";
export { treasuryEntryLabel } from "@/modules/treasury/lib/treasury-view";

export async function listTreasuryOptions(): Promise<TreasurySummary[]> {
  const [treasuries, stores] = await Promise.all([
    treasuryRepo.listTreasuries(),
    listStores(),
  ]);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  return treasuries
    .map((t) => ({
      ...t,
      storeName: t.store_id ? storeName.get(t.store_id) ?? null : null,
      label:
        t.kind === "hq"
          ? "الخزينة الرئيسية"
          : `خزينة ${storeName.get(t.store_id ?? "") ?? "فرع"}`,
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "hq" ? -1 : 1;
      return a.label.localeCompare(b.label, "ar");
    });
}

export async function loadTreasuryPageData(filters?: {
  treasuryId?: string;
  entryType?: CashTreasuryEntryType;
  from?: string;
  to?: string;
}): Promise<TreasuryPageData> {
  const [treasuries, ledger, closings, stores] = await Promise.all([
    listTreasuryOptions(),
    treasuryRepo.listTreasuryLedger({
      treasuryId: filters?.treasuryId,
      entryType: filters?.entryType,
      from: filters?.from,
      to: filters?.to,
      limit: 150,
    }),
    closingRepo.listClosings(),
    listStores(),
  ]);
  const storeName = new Map(stores.map((s) => [s.id, s.name]));
  const closedPeriods = closings
    .filter((c) => c.status === "closed" && c.store_id)
    .map((c) => ({
      ...c,
      storeName: c.store_id ? storeName.get(c.store_id) ?? null : null,
    }))
    .sort((a, b) => b.period_end.localeCompare(a.period_end));

  return { treasuries, ledger, closedPeriods };
}

export async function transferBetweenTreasuries(input: {
  fromTreasuryId: string;
  toTreasuryId: string;
  amount: number;
  notes?: string;
}): Promise<void> {
  const amount = roundMoney(input.amount);
  if (amount <= 0) throw new Error("أدخل مبلغ تحويل أكبر من صفر");
  await treasuryRepo.transfer({
    fromTreasuryId: input.fromTreasuryId,
    toTreasuryId: input.toTreasuryId,
    amount,
    notes: input.notes,
  });
}

export async function sweepClosedPeriodToHq(input: {
  storeId: string;
  periodId: string;
  notes?: string;
}): Promise<number> {
  const closing = await closingRepo.getClosing(input.periodId);
  if (!closing) throw new Error("الفترة غير موجودة");
  if (closing.status !== "closed") {
    throw new Error("لازم الفترة تكون مقفولة قبل سحبها للخزينة الرئيسية");
  }
  if (closing.store_id && closing.store_id !== input.storeId) {
    throw new Error("الفترة مش لنفس الفرع");
  }
  return treasuryRepo.periodSweep({
    storeId: input.storeId,
    periodId: input.periodId,
    notes: input.notes,
  });
}

export async function postExpenseToTreasury(input: {
  treasuryId: string;
  expenseId: string;
  amount: number;
}): Promise<void> {
  await treasuryRepo.postExpense({
    treasuryId: input.treasuryId,
    expenseId: input.expenseId,
    amount: roundMoney(input.amount),
  });
}

export async function postCollectionToTreasury(input: {
  treasuryId: string;
  customerPaymentId: string;
  amount: number;
}): Promise<void> {
  await treasuryRepo.postCollection({
    treasuryId: input.treasuryId,
    customerPaymentId: input.customerPaymentId,
    amount: roundMoney(input.amount),
  });
}

export async function postSupplierPayToTreasury(input: {
  treasuryId: string;
  supplierPaymentId: string;
  amount: number;
}): Promise<void> {
  await treasuryRepo.postSupplierPay({
    treasuryId: input.treasuryId,
    supplierPaymentId: input.supplierPaymentId,
    amount: roundMoney(input.amount),
  });
}
