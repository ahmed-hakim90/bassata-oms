import { describe, expect, it } from "vitest";
import { sumLinkedInvoiceExtraCost } from "@/modules/purchases/lib/landed-cost-split";

describe("sumLinkedInvoiceExtraCost", () => {
  it("sums supplier extra_cost on linked invoices", () => {
    expect(
      sumLinkedInvoiceExtraCost([
        { extra_cost: 120 },
        { extra_cost: 30.255 },
      ])
    ).toBe(150.26);
  });

  it("ignores negative extra_cost", () => {
    expect(
      sumLinkedInvoiceExtraCost([{ extra_cost: -10 }, { extra_cost: 40 }])
    ).toBe(40);
  });

  it("returns zero when invoices have no extra_cost", () => {
    expect(sumLinkedInvoiceExtraCost([{ extra_cost: 0 }, { extra_cost: 0 }])).toBe(0);
    expect(sumLinkedInvoiceExtraCost([])).toBe(0);
  });
});
