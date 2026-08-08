import { describe, expect, it } from "vitest";
import {
  applyRunningBalance,
  expenseContribution,
  isDebitNormal,
  revenueContribution,
  signedBalance,
  withRunningBalances,
} from "@/modules/accounting/lib/account-balance";

describe("account balance nature", () => {
  it("treats asset and expense as debit-normal", () => {
    expect(isDebitNormal("asset")).toBe(true);
    expect(isDebitNormal("expense")).toBe(true);
    expect(isDebitNormal("liability")).toBe(false);
    expect(isDebitNormal("equity")).toBe(false);
    expect(isDebitNormal("revenue")).toBe(false);
  });

  it("computes signed balances by nature", () => {
    expect(signedBalance("asset", 100, 30)).toBe(70);
    expect(signedBalance("expense", 50, 0)).toBe(50);
    expect(signedBalance("liability", 10, 90)).toBe(80);
    expect(signedBalance("revenue", 0, 200)).toBe(200);
  });

  it("treats sales_discount (revenue type) as reducing revenue via credit − debit", () => {
    expect(revenueContribution(40, 0)).toBe(-40);
    expect(revenueContribution(0, 500)).toBe(500);
    expect(roundNet(500, -40)).toBe(460);
  });

  it("builds running balances for debit-normal accounts", () => {
    const rows = withRunningBalances("asset", 100, [
      { debit: 50, credit: 0 },
      { debit: 0, credit: 20 },
      { debit: 10, credit: 0 },
    ]);
    expect(rows.map((r) => r.runningBalance)).toEqual([150, 130, 140]);
    expect(applyRunningBalance("asset", 100, 0, 25)).toBe(75);
  });

  it("builds running balances for credit-normal accounts", () => {
    const rows = withRunningBalances("revenue", 0, [
      { debit: 0, credit: 200 },
      { debit: 30, credit: 0 },
    ]);
    expect(rows.map((r) => r.runningBalance)).toEqual([200, 170]);
  });

  it("computes expense contribution", () => {
    expect(expenseContribution(80, 5)).toBe(75);
  });
});

function roundNet(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}
