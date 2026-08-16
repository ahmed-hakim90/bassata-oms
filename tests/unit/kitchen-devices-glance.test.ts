import { describe, expect, it } from "vitest";
import { buildKitchenGlance } from "@/modules/kitchen/lib/kitchen-glance";
import { buildDevicesGlance } from "@/modules/devices/lib/devices-glance";
import type { KitchenTicket } from "@/modules/kitchen/services/kitchen.service";

describe("buildKitchenGlance", () => {
  it("counts backlog and oldest wait without inventing prep duration", () => {
    const now = Date.now();
    const tickets = [
      {
        id: "1",
        orderNumber: "A1",
        kitchenStatus: "queued",
        createdAt: new Date(now - 30 * 60000).toISOString(),
        total: 10,
        items: [],
      },
      {
        id: "2",
        orderNumber: "A2",
        kitchenStatus: "preparing",
        createdAt: new Date(now - 10 * 60000).toISOString(),
        total: 20,
        items: [],
      },
      {
        id: "3",
        orderNumber: "A3",
        kitchenStatus: "ready",
        createdAt: new Date(now - 5 * 60000).toISOString(),
        total: 15,
        items: [],
      },
    ] as KitchenTicket[];

    const glance = buildKitchenGlance(tickets);
    expect(glance.backlog).toBe(3);
    expect(glance.queued).toBe(1);
    expect(glance.preparing).toBe(1);
    expect(glance.ready).toBe(1);
    expect(glance.oldestWaitMinutes).toBe(30);
  });
});

describe("buildDevicesGlance", () => {
  it("classifies recent vs stale active devices from last_seen_at", () => {
    const now = Date.now();
    const glance = buildDevicesGlance({
      nowMs: now,
      storeNames: { s1: "فرع وسط", s2: "فرع المعادي" },
      devices: [
        {
          store_id: "s1",
          is_active: true,
          last_seen_at: new Date(now - 60 * 60 * 1000).toISOString(),
        },
        {
          store_id: "s1",
          is_active: true,
          last_seen_at: null,
        },
        {
          store_id: "s2",
          is_active: false,
          last_seen_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    expect(glance.total).toBe(3);
    expect(glance.active).toBe(2);
    expect(glance.inactive).toBe(1);
    expect(glance.seenRecently).toBe(1);
    expect(glance.staleOrNever).toBe(1);
    expect(glance.byStoreChart[0]?.count).toBe(2);
  });
});
