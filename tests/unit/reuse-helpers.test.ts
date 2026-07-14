import { describe, expect, it } from "vitest";
import { roundMoney } from "@/lib/money";
import { computeInvoiceTotals, invoiceLineTotal } from "@/modules/sales-invoices/lib/invoice-math";
import { enabledPaymentMethodsFromFlags } from "@/lib/enabled-payment-methods";
import { resolveDisplayPriceRange } from "@/modules/products/lib/display-price-range";

describe("roundMoney", () => {
  it("rounds to 2 decimal places", () => {
    expect(roundMoney(1.006)).toBe(1.01);
    expect(roundMoney(10.1)).toBe(10.1);
    expect(roundMoney(19.999)).toBe(20);
  });
});

describe("invoice-math", () => {
  it("computes line and document totals", () => {
    expect(invoiceLineTotal(2, 12.5)).toBe(25);
    const totals = computeInvoiceTotals({
      lines: [{ line_total: 100 }, { line_total: 50 }],
      discount: 10,
      taxRate: 0.14,
    });
    expect(totals.subtotal).toBe(150);
    expect(totals.discount).toBe(10);
    expect(totals.tax).toBe(19.6);
    expect(totals.total).toBe(159.6);
  });
});

describe("enabledPaymentMethodsFromFlags", () => {
  it("maps flags to payment methods", () => {
    expect(
      enabledPaymentMethodsFromFlags({
        payment_cash: true,
        payment_card: false,
        payment_wallet: true,
        credit_sales: true,
      })
    ).toEqual(["cash", "wallet", "credit"]);
  });
});

describe("resolveDisplayPriceRange", () => {
  it("returns range when variants differ", () => {
    const result = resolveDisplayPriceRange({
      variantPrices: [20, 30],
      baseAmount: 15,
      rangeSeparator: "en-dash",
    });
    expect(result.amount).toBe(20);
    expect(result.rangeLabel).toContain("30");
  });

  it("falls back to base when no variants", () => {
    const result = resolveDisplayPriceRange({
      variantPrices: [],
      baseAmount: 15,
    });
    expect(result.amount).toBe(15);
    expect(result.rangeLabel).toBe("");
  });
});
