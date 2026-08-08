import { describe, expect, it } from "vitest";
import {
  buildPurchaseJournalLines,
  buildSaleJournalLines,
  buildSupplierPaymentJournalLines,
  buildWasteJournalLines,
  reverseBuiltLines,
} from "@/modules/accounting/lib/gl-posting-lines";
import { isJournalBalanced } from "@/modules/accounting/lib/journal-balance";

describe("buildSaleJournalLines", () => {
  it("builds balanced sale lines with tax and discount", () => {
    const lines = buildSaleJournalLines({
      total: 104,
      tax: 14,
      discount: 10,
      payments: [{ method: "cash", amount: 104 }],
    });

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ systemKey: "cash", debit: 104, credit: 0 }),
        expect.objectContaining({ systemKey: "sales_discount", debit: 10, credit: 0 }),
        expect.objectContaining({ systemKey: "sales_revenue", debit: 0, credit: 100 }),
        expect.objectContaining({ systemKey: "tax_payable", debit: 0, credit: 14 }),
      ])
    );
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it("maps credit payments to AR and posts COGS", () => {
    const lines = buildSaleJournalLines({
      total: 50,
      tax: 0,
      discount: 0,
      payments: [{ method: "credit", amount: 50 }],
      cogs: 20,
    });

    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ systemKey: "ar", debit: 50, credit: 0 }),
        expect.objectContaining({ systemKey: "sales_revenue", debit: 0, credit: 50 }),
        expect.objectContaining({ systemKey: "cogs", debit: 20, credit: 0 }),
        expect.objectContaining({ systemKey: "inventory", debit: 0, credit: 20 }),
      ])
    );
    expect(isJournalBalanced(lines)).toBe(true);
  });

  it("splits payment methods", () => {
    const lines = buildSaleJournalLines({
      total: 100,
      tax: 0,
      discount: 0,
      payments: [
        { method: "cash", amount: 40 },
        { method: "card", amount: 60 },
      ],
    });
    expect(lines.find((l) => l.systemKey === "cash")?.debit).toBe(40);
    expect(lines.find((l) => l.systemKey === "card")?.debit).toBe(60);
    expect(isJournalBalanced(lines)).toBe(true);
  });
});

describe("buildPurchaseJournalLines", () => {
  it("credits AP for unpaid remainder and payment account for paid portion", () => {
    const lines = buildPurchaseJournalLines({
      total: 200,
      amountPaid: 50,
      paymentMethod: "cash",
    });
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ systemKey: "inventory", debit: 200, credit: 0 }),
        expect.objectContaining({ systemKey: "cash", debit: 0, credit: 50 }),
        expect.objectContaining({ systemKey: "ap", debit: 0, credit: 150 }),
      ])
    );
    expect(isJournalBalanced(lines)).toBe(true);
  });
});

describe("buildSupplierPaymentJournalLines", () => {
  it("debits AP and credits payment account", () => {
    const lines = buildSupplierPaymentJournalLines({
      amount: 75,
      paymentMethod: "wallet",
    });
    expect(lines).toEqual([
      { systemKey: "ap", debit: 75, credit: 0 },
      { systemKey: "wallet", debit: 0, credit: 75 },
    ]);
  });
});

describe("buildWasteJournalLines", () => {
  it("debits waste and credits inventory", () => {
    const lines = buildWasteJournalLines({ cost: 12.5 });
    expect(lines).toEqual([
      { systemKey: "waste", debit: 12.5, credit: 0 },
      { systemKey: "inventory", debit: 0, credit: 12.5 },
    ]);
    expect(isJournalBalanced(lines)).toBe(true);
  });
});

describe("reverseBuiltLines", () => {
  it("flips a balanced sale into a balanced reversal", () => {
    const sale = buildSaleJournalLines({
      total: 100,
      tax: 0,
      discount: 0,
      payments: [{ method: "cash", amount: 100 }],
      cogs: 40,
    });
    const reversed = reverseBuiltLines(sale);
    expect(isJournalBalanced(reversed)).toBe(true);
    expect(reversed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ systemKey: "cash", debit: 0, credit: 100 }),
        expect.objectContaining({ systemKey: "sales_revenue", debit: 100, credit: 0 }),
        expect.objectContaining({ systemKey: "cogs", debit: 0, credit: 40 }),
        expect.objectContaining({ systemKey: "inventory", debit: 40, credit: 0 }),
      ])
    );
  });
});
