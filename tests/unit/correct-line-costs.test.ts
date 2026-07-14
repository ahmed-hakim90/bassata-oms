import { describe, expect, it } from "vitest";
import {
  buildSalesInvoiceCostCorrections,
  resolveCorrectedLineCost,
  summarizeCostCorrections,
} from "@/modules/sales-invoices/lib/correct-line-costs";

describe("resolveCorrectedLineCost", () => {
  it("uses base_quantity for tracked weight sales", () => {
    const result = resolveCorrectedLineCost({
      quantity: 0.25,
      baseQuantity: 0.25,
      lastUnitCost: 40,
    });
    expect(result.unitCost).toBe(40);
    expect(result.lineCost).toBe(10);
  });

  it("falls back to quantity when base_quantity is missing", () => {
    const result = resolveCorrectedLineCost({
      quantity: 2,
      baseQuantity: null,
      lastUnitCost: 15,
    });
    expect(result.lineCost).toBe(30);
  });

  it("prefers recipe unit cost × sale quantity", () => {
    const result = resolveCorrectedLineCost({
      quantity: 3,
      baseQuantity: 3,
      lastUnitCost: 99,
      recipeUnitCost: 12.5,
    });
    expect(result.unitCost).toBe(12.5);
    expect(result.lineCost).toBe(37.5);
  });
});

describe("buildSalesInvoiceCostCorrections", () => {
  it("marks zero-cost lines as changed when purchase cost exists", () => {
    const rows = buildSalesInvoiceCostCorrections(
      [
        {
          id: "l1",
          product_id: "p1",
          quantity: 0.5,
          base_quantity: 0.5,
          unit_cost: 0,
          line_cost: 0,
        },
      ],
      new Map([["p1", { last_unit_cost: 80 }]])
    );
    expect(rows[0]?.changed).toBe(true);
    expect(rows[0]?.lineCost).toBe(40);
    expect(rows[0]?.previousLineCost).toBe(0);
  });

  it("reports unchanged when costs already match", () => {
    const rows = buildSalesInvoiceCostCorrections(
      [
        {
          id: "l1",
          product_id: "p1",
          quantity: 1,
          base_quantity: 1,
          unit_cost: 20,
          line_cost: 20,
        },
      ],
      new Map([["p1", { last_unit_cost: 20 }]])
    );
    expect(rows[0]?.changed).toBe(false);
  });
});

describe("summarizeCostCorrections", () => {
  it("sums previous and next totals", () => {
    const summary = summarizeCostCorrections([
      {
        lineId: "a",
        productId: "p1",
        previousUnitCost: 0,
        previousLineCost: 0,
        unitCost: 10,
        lineCost: 10,
        changed: true,
      },
      {
        lineId: "b",
        productId: "p2",
        previousUnitCost: 5,
        previousLineCost: 5,
        unitCost: 5,
        lineCost: 5,
        changed: false,
      },
    ]);
    expect(summary).toEqual({
      previousTotal: 5,
      nextTotal: 15,
      changedLines: 1,
    });
  });
});
