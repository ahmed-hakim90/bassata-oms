import { describe, expect, it } from "vitest";
import {
  aggregateCategoryMargins,
  aggregateCashierPerformance,
  buildHeatmapCells,
  buildPnlStatement,
  computePeriodDelta,
  previousEqualLengthRange,
} from "@/modules/reports/services/executive-analytics.service";
import type { CashierSession, Order } from "@/lib/types";
import type { ProductProfitRow } from "@/modules/reports/services/profit-report.service";

describe("executive analytics pure helpers", () => {
  it("computes previous equal-length range", () => {
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-08-08T23:59:59.000Z");
    const prev = previousEqualLengthRange(from, to);
    const duration = to.getTime() - from.getTime();
    expect(prev.to.getTime()).toBe(from.getTime() - 1);
    expect(prev.to.getTime() - prev.from.getTime()).toBe(duration);
  });

  it("computes period delta percent", () => {
    expect(computePeriodDelta(120, 100)).toEqual({
      current: 120,
      previous: 100,
      delta: 20,
      deltaPct: 20,
    });
    expect(computePeriodDelta(50, 0).deltaPct).toBeNull();
    expect(computePeriodDelta(0, 0).deltaPct).toBe(0);
  });

  it("buckets heatmap by weekday hour", () => {
    const orders = [
      {
        created_at: "2026-08-03T14:30:00.000Z", // Monday UTC
        total: 100,
        document_date: "2026-08-03",
      },
      {
        created_at: "2026-08-03T14:45:00.000Z",
        total: 50,
        document_date: "2026-08-03",
      },
    ];
    const cells = buildHeatmapCells(orders, "weekday");
    expect(cells.length).toBeGreaterThanOrEqual(1);
    const cell = cells.find((c) => c.hour === new Date(orders[0].created_at).getHours());
    expect(cell?.revenue).toBe(150);
    expect(cell?.orderCount).toBe(2);
  });

  it("aggregates cashier performance via session_id", () => {
    const from = new Date("2026-08-01T00:00:00.000Z");
    const to = new Date("2026-08-08T23:59:59.000Z");
    const sessions = [
      {
        id: "s1",
        store_id: "st1",
        device_id: null,
        cashier_id: "c1",
        opened_at: "2026-08-02T08:00:00.000Z",
        closed_at: "2026-08-02T16:00:00.000Z",
        opening_cash: 0,
        expected_cash: 100,
        actual_cash: 90,
        variance: -10,
        status: "closed",
        notes: null,
        closed_by: "c1",
        close_reason: null,
        force_closed: false,
      },
    ] as CashierSession[];
    const orders = [
      {
        id: "o1",
        store_id: "st1",
        session_id: "s1",
        order_number: "1",
        customer_id: null,
        status: "completed",
        subtotal: 100,
        discount: 0,
        tax: 0,
        total: 100,
        payment_status: "paid",
        created_by: "c1",
        created_at: "2026-08-02T10:00:00.000Z",
      },
      {
        id: "o2",
        store_id: "st1",
        session_id: null,
        order_number: "2",
        customer_id: null,
        status: "completed",
        subtotal: 50,
        discount: 0,
        tax: 0,
        total: 50,
        payment_status: "paid",
        created_by: "c1",
        created_at: "2026-08-02T11:00:00.000Z",
      },
    ] as Order[];
    const rows = aggregateCashierPerformance(
      sessions,
      orders,
      new Map([["c1", "أحمد"]]),
      from,
      to
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].cashierName).toBe("أحمد");
    expect(rows[0].orderCount).toBe(1);
    expect(rows[0].revenue).toBe(100);
    expect(rows[0].totalVariance).toBe(-10);
  });

  it("aggregates category margins", () => {
    const products: ProductProfitRow[] = [
      {
        productId: "p1",
        name: "A",
        quantitySold: 2,
        revenue: 100,
        cost: 40,
        profit: 60,
        margin: 60,
      },
      {
        productId: "p2",
        name: "B",
        quantitySold: 1,
        revenue: 50,
        cost: 40,
        profit: 10,
        margin: 20,
      },
    ];
    const rows = aggregateCategoryMargins(
      products,
      new Map([
        ["p1", "cat1"],
        ["p2", "cat1"],
      ]),
      new Map([["cat1", "مشروبات"]])
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].categoryName).toBe("مشروبات");
    expect(rows[0].revenue).toBe(150);
    expect(rows[0].profit).toBe(70);
  });

  it("builds pnl lines including refunds in estimated net", () => {
    const { lines, estimatedNet } = buildPnlStatement({
      revenue: 1000,
      cogs: 400,
      expensesByCostCenter: [],
      totalExpenses: 100,
      purchases: 0,
      wasteCost: 50,
      refunds: 25,
      grossProfit: 600,
      estimatedNetProfit: 450,
      orderCount: 10,
      avgOrderProfit: 60,
      inventory: {
        inventorySellValue: 0,
        inventoryCostValue: 0,
        inventoryExpectedProfit: 0,
      },
      invoices: [],
      purchaseInvoices: [],
      byDay: [],
      products: [],
      highestProfitProducts: [],
      highestSellingProducts: [],
    });
    expect(estimatedNet).toBe(425);
    expect(lines.find((l) => l.key === "net")?.amount).toBe(425);
    expect(lines.find((l) => l.key === "refunds")?.amount).toBe(-25);
  });
});
