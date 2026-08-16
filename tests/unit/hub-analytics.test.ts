import { describe, expect, it } from "vitest";
import {
  buildAccountingHubAnalytics,
  buildAdminHubAnalytics,
  buildCatalogHubAnalytics,
  buildCustomersHubAnalytics,
  buildOperationsHubAnalytics,
  buildPurchasingHubAnalytics,
  buildSalesDocumentsHubAnalytics,
} from "@/modules/module-hubs/lib/build-hub-analytics";

describe("hub analytics builders", () => {
  it("builds operations KPIs and hourly chart", () => {
    const analytics = buildOperationsHubAnalytics({
      currency: "EGP",
      todaySales: 1200,
      todayOrders: 8,
      avgTicket: 150,
      openSessions: 2,
      onlineActive: 1,
      salesSparkline: [
        { hour: "10", total: 200 },
        { hour: "11", total: 400 },
      ],
    });
    expect(analytics.kpis).toHaveLength(4);
    expect(analytics.chart?.rows).toHaveLength(2);
    expect(analytics.chart?.format).toBe("currency");
  });

  it("builds sales documents kind chart", () => {
    const analytics = buildSalesDocumentsHubAnalytics({
      currency: "EGP",
      byKind: [
        { label: "عروض", count: 2 },
        { label: "فواتير", count: 5 },
      ],
      openTotal: 900,
      draftCount: 1,
      issuedCount: 4,
    });
    expect(analytics.chart?.rows[1]?.value).toBe(5);
    expect(analytics.kpis[2]?.label).toBe("قيمة مفتوحة");
  });

  it("builds catalog health rows", () => {
    const analytics = buildCatalogHubAnalytics({
      currency: "EGP",
      totalSkus: 40,
      lowStock: 3,
      nearExpiry: 1,
      sellValue: 5000,
    });
    expect(analytics.kpis[1]?.trend).toBe("down");
    expect(analytics.chart?.rows[0]?.value).toBe(40);
  });

  it("builds purchasing with aging when provided", () => {
    const analytics = buildPurchasingHubAnalytics({
      currency: "EGP",
      draftCount: 2,
      receivedCount: 7,
      supplierDue: 300,
      paid30d: 100,
      agingBuckets: {
        current: 50,
        days30: 40,
        days60: 30,
        days90: 20,
        over90: 10,
      },
    });
    expect(analytics.agingTitle).toMatch(/الموردين/);
    expect(analytics.chart?.rows).toHaveLength(2);
    expect(analytics.analysisLinks?.length).toBeGreaterThan(0);
  });

  it("builds customers aging board", () => {
    const analytics = buildCustomersHubAnalytics({
      currency: "EGP",
      customerCount: 12,
      outstanding: 800,
      collected30d: 200,
      partiesWithBalance: 4,
      agingBuckets: {
        current: 100,
        days30: 200,
        days60: 0,
        days90: 0,
        over90: 0,
      },
    });
    expect(analytics.kpis[0]?.value).toBe("12");
    expect(analytics.agingBuckets?.days30).toBe(200);
    expect(analytics.analysisLinks?.[0]?.href).toContain("aging");
  });

  it("builds accounting journal status chart", () => {
    const analytics = buildAccountingHubAnalytics({
      accountCount: 30,
      postableCount: 20,
      postedCount: 15,
      draftCount: 2,
      voidCount: 1,
      autoPostedCount: 10,
    });
    expect(analytics.chart?.rows.find((r) => r.label === "أوتو")?.value).toBe(10);
  });

  it("builds admin devices by store chart", () => {
    const analytics = buildAdminHubAnalytics({
      totalDevices: 5,
      activeDevices: 4,
      seenRecently: 3,
      staleOrNever: 1,
      byStoreChart: [{ label: "فرع أ", count: 3 }],
    });
    expect(analytics.chart?.rows[0]?.value).toBe(3);
  });
});
