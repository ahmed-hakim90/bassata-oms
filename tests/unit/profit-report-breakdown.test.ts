import { describe, expect, it } from "vitest";
import {
  buildDayProfitRows,
  buildInvoiceProfitRows,
  buildProductProfitRows,
  buildPurchaseInvoiceProfitRows,
  rankHighestProfitProducts,
  rankHighestSellingProducts,
} from "@/modules/reports/services/profit-report.service";

const orders = [
  {
    id: "o1",
    order_number: "A-1",
    created_at: "2026-07-10T10:00:00.000Z",
    total: 100,
    subtotal: 100,
  },
  {
    id: "o2",
    order_number: "A-2",
    created_at: "2026-07-11T12:00:00.000Z",
    total: 50,
    subtotal: 50,
  },
  {
    id: "o3",
    order_number: "A-3",
    created_at: "2026-07-11T15:00:00.000Z",
    total: 80,
    subtotal: 100,
  },
];

const items = [
  { order_id: "o1", product_id: "p1", quantity: 2, line_total: 100, line_cost: 40 },
  { order_id: "o2", product_id: "p2", quantity: 1, line_total: 50, line_cost: 20 },
  { order_id: "o3", product_id: "p1", quantity: 1, line_total: 60, line_cost: 20 },
  { order_id: "o3", product_id: "p2", quantity: 2, line_total: 40, line_cost: 10 },
];

describe("buildInvoiceProfitRows", () => {
  it("computes expected profit per invoice from line costs", () => {
    const rows = buildInvoiceProfitRows(orders, items);
    expect(rows[0]?.orderNumber).toBe("A-3");
    expect(rows.find((r) => r.orderId === "o1")).toMatchObject({
      revenue: 100,
      cost: 40,
      profit: 60,
      margin: 60,
      itemCount: 1,
    });
    expect(rows.find((r) => r.orderId === "o3")).toMatchObject({
      revenue: 80,
      cost: 30,
      profit: 50,
      itemCount: 2,
    });
  });
});

describe("buildDayProfitRows", () => {
  it("aggregates revenue cost and profit by calendar day", () => {
    const rows = buildDayProfitRows(orders, items);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-07-10",
      revenue: 100,
      cost: 40,
      profit: 60,
      orders: 1,
    });
    expect(rows[1]).toMatchObject({
      date: "2026-07-11",
      revenue: 130,
      cost: 50,
      profit: 80,
      orders: 2,
    });
  });
});

describe("buildProductProfitRows", () => {
  it("applies order discount factor to line revenue", () => {
    const names = new Map([
      ["p1", "Tea"],
      ["p2", "Coffee"],
    ]);
    const rows = buildProductProfitRows(orders, items, names);
    const tea = rows.find((r) => r.productId === "p1");
    const coffee = rows.find((r) => r.productId === "p2");
    // o3 factor = 80/100 = 0.8 → tea line 60*0.8=48, coffee 40*0.8=32
    expect(tea?.revenue).toBeCloseTo(148); // 100 + 48
    expect(tea?.cost).toBe(60);
    expect(tea?.profit).toBeCloseTo(88);
    expect(coffee?.revenue).toBeCloseTo(82); // 50 + 32
    expect(coffee?.profit).toBeCloseTo(52);
  });
});

describe("product rankings", () => {
  it("ranks by profit and by revenue separately", () => {
    const products = [
      {
        productId: "a",
        name: "A",
        quantitySold: 1,
        revenue: 200,
        cost: 180,
        profit: 20,
        margin: 10,
      },
      {
        productId: "b",
        name: "B",
        quantitySold: 5,
        revenue: 100,
        cost: 20,
        profit: 80,
        margin: 80,
      },
    ];
    expect(rankHighestProfitProducts(products, 1)[0]?.productId).toBe("b");
    expect(rankHighestSellingProducts(products, 1)[0]?.productId).toBe("a");
  });
});

describe("buildPurchaseInvoiceProfitRows", () => {
  it("computes expected sell minus purchase cost per received invoice", () => {
    const rows = buildPurchaseInvoiceProfitRows(
      [
        {
          id: "pi1",
          invoice_number: "PO-1",
          received_at: "2026-07-10T10:00:00.000Z",
          total: 100,
          status: "received",
        },
        {
          id: "pi2",
          invoice_number: "PO-2",
          received_at: null,
          total: 50,
          status: "draft",
        },
      ],
      [
        {
          invoice_id: "pi1",
          product_id: "p1",
          quantity: 5,
          line_total: 60,
          landed_line_total: 70,
        },
        {
          invoice_id: "pi1",
          product_id: "p2",
          quantity: 2,
          line_total: 30,
          landed_line_total: null,
        },
      ],
      new Map([
        ["p1", 20],
        ["p2", 15],
      ])
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      invoiceNumber: "PO-1",
      // sell: 5*20 + 2*15 = 130; cost: 70 + 30 = 100
      expectedSellValue: 130,
      purchaseCost: 100,
      expectedProfit: 30,
      itemCount: 2,
    });
  });
});
