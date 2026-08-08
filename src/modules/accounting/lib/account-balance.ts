import { roundMoney } from "@/lib/money";
import type { GlAccountType } from "@/lib/types";

/** Assets and expenses are debit-normal; liability, equity, revenue are credit-normal. */
export function isDebitNormal(accountType: GlAccountType | string): boolean {
  return accountType === "asset" || accountType === "expense";
}

/**
 * Signed natural balance: positive means balance on the account's normal side.
 * Debit-normal: debit − credit. Credit-normal: credit − debit.
 */
export function signedBalance(
  accountType: GlAccountType | string,
  debit: number,
  credit: number
): number {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  if (isDebitNormal(accountType)) {
    return roundMoney(d - c);
  }
  return roundMoney(c - d);
}

/** Advance a signed running balance by one movement. */
export function applyRunningBalance(
  accountType: GlAccountType | string,
  previous: number,
  debit: number,
  credit: number
): number {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  if (isDebitNormal(accountType)) {
    return roundMoney(previous + d - c);
  }
  return roundMoney(previous + c - d);
}

/**
 * Build movements with running balances from an opening signed balance.
 * Input movements must already be sorted chronologically.
 */
export function withRunningBalances<
  T extends { debit: number; credit: number },
>(
  accountType: GlAccountType | string,
  openingBalance: number,
  movements: T[]
): Array<T & { runningBalance: number }> {
  let running = roundMoney(openingBalance);
  return movements.map((movement) => {
    running = applyRunningBalance(
      accountType,
      running,
      movement.debit,
      movement.credit
    );
    return { ...movement, runningBalance: running };
  });
}

/** Revenue contribution (credit − debit). Contra-revenue like sales_discount reduces net. */
export function revenueContribution(debit: number, credit: number): number {
  return roundMoney((Number(credit) || 0) - (Number(debit) || 0));
}

/** Expense contribution (debit − credit). */
export function expenseContribution(debit: number, credit: number): number {
  return roundMoney((Number(debit) || 0) - (Number(credit) || 0));
}
