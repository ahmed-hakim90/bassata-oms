import { roundMoney } from "@/lib/money";

export type BalanceLine = {
  debit: number;
  credit: number;
};

/** True when total debits equal total credits (within 0.01). */
export function isJournalBalanced(lines: BalanceLine[]): boolean {
  const debit = roundMoney(lines.reduce((sum, line) => sum + (line.debit || 0), 0));
  const credit = roundMoney(lines.reduce((sum, line) => sum + (line.credit || 0), 0));
  return Math.abs(debit - credit) < 0.01 && debit > 0;
}

export function journalTotals(lines: BalanceLine[]): { debit: number; credit: number } {
  return {
    debit: roundMoney(lines.reduce((sum, line) => sum + (line.debit || 0), 0)),
    credit: roundMoney(lines.reduce((sum, line) => sum + (line.credit || 0), 0)),
  };
}

export function assertJournalBalanced(lines: BalanceLine[]): void {
  if (lines.length < 2) {
    throw new Error("القيد لازم يبقى فيه سطرين على الأقل");
  }
  for (const line of lines) {
    const debit = roundMoney(line.debit || 0);
    const credit = roundMoney(line.credit || 0);
    if (debit < 0 || credit < 0) {
      throw new Error("المدين والدائن لازم يكونوا صفر أو أكبر");
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new Error("كل سطر لازم يكون مدين أو دائن فقط");
    }
  }
  if (!isJournalBalanced(lines)) {
    const totals = journalTotals(lines);
    throw new Error(
      `القيد مش متوازن — مدين ${totals.debit.toFixed(2)} ≠ دائن ${totals.credit.toFixed(2)}`
    );
  }
}
