import { describe, expect, it } from "vitest";
import { allocateLandedCosts } from "@/modules/purchases/services/purchase.service";
import type { PurchaseInvoiceLine } from "@/lib/types";

function line(id: string, quantity: number, unitCost: number): PurchaseInvoiceLine {
  return {
    id,
    invoice_id: "invoice-1",
    product_id: `product-${id}`,
    variant_id: null,
    quantity,
    unit_cost: unitCost,
    line_total: quantity * unitCost,
    landed_unit_cost: null,
    landed_line_total: null,
  };
}

describe("allocateLandedCosts", () => {
  it("allocates extra cost proportionally by line total", () => {
    const allocations = allocateLandedCosts(
      [line("a", 2, 10), line("b", 4, 5)],
      8
    );

    expect(allocations.get("a")).toEqual({
      landedLineTotal: 24,
      landedUnitCost: 12,
    });
    expect(allocations.get("b")).toEqual({
      landedLineTotal: 24,
      landedUnitCost: 6,
    });
  });
});
