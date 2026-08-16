import { describe, expect, it } from "vitest";
import { buildOnlineOrdersGlance } from "@/modules/online-orders/lib/online-orders-glance";
import type { OnlineOrderStatus } from "@/lib/types";

function order(status: OnlineOrderStatus, total: number) {
  return { status, total };
}

describe("buildOnlineOrdersGlance", () => {
  it("computes status counts and AOV excluding cancelled", () => {
    const glance = buildOnlineOrdersGlance({
      orders: [
        order("pending", 100),
        order("ready", 200),
        order("cancelled", 999),
        order("invoiced", 50),
      ],
      menuViewStats: {
        days: 7,
        total: 40,
        bySource: [
          { source: "qr", viewCount: 25 },
          { source: "whatsapp", viewCount: 15 },
        ],
      },
    });

    expect(glance.total).toBe(4);
    expect(glance.active).toBe(2);
    expect(glance.pending).toBe(1);
    expect(glance.ready).toBe(1);
    expect(glance.aov).toBe(Math.round(((100 + 200 + 50) / 3) * 100) / 100);
    expect(glance.revenueNonCancelled).toBe(350);
    expect(glance.menuViewsTotal).toBe(40);
    expect(glance.sourceChart.map((r) => r.label)).toEqual(["رمز QR", "واتساب"]);
    expect(glance.statusChart.some((r) => r.label === "معلق" && r.count === 1)).toBe(true);
  });

  it("handles empty orders", () => {
    const glance = buildOnlineOrdersGlance({ orders: [] });
    expect(glance.active).toBe(0);
    expect(glance.aov).toBe(0);
    expect(glance.statusChart).toEqual([]);
  });
});
