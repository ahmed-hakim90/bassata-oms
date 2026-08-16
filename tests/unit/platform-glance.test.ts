import { describe, expect, it } from "vitest";
import {
  buildPlatformOrgGlance,
  buildPlatformUsageGlance,
} from "@/modules/platform/lib/platform-glance";
import type { PlatformOrganizationSummary } from "@/modules/platform/services/platform-org.service";
import type { PlatformOrgUsageRow } from "@/modules/platform/services/platform-plan.service";

function org(
  partial: Partial<PlatformOrganizationSummary> &
    Pick<PlatformOrganizationSummary, "id" | "name" | "status">
): PlatformOrganizationSummary {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    currency: "EGP",
    country: "EG",
    health: {
      storeCount: 1,
      userCount: 2,
      productCount: 0,
      customerCount: 0,
      orderCount: 0,
      expenseCount: 0,
      purchaseCount: 0,
      inventoryMovementCount: 0,
      auditLogCount: 0,
      databaseBytes: 0,
      deviceCount: 0,
      lastOrderAt: null,
      ...partial.health,
    },
    ...partial,
  };
}

describe("buildPlatformOrgGlance", () => {
  it("rolls up health and marks quiet active orgs without inventing billing", () => {
    const now = Date.parse("2026-08-16T12:00:00.000Z");
    const glance = buildPlatformOrgGlance({
      nowMs: now,
      pendingInvites: 3,
      organizations: [
        org({
          id: "a",
          name: "Café Active",
          status: "active",
          health: {
            storeCount: 2,
            userCount: 5,
            productCount: 0,
            customerCount: 0,
            orderCount: 100,
            expenseCount: 0,
            purchaseCount: 0,
            inventoryMovementCount: 0,
            auditLogCount: 0,
            databaseBytes: 0,
            deviceCount: 3,
            lastOrderAt: "2026-08-15T12:00:00.000Z",
          },
        }),
        org({
          id: "b",
          name: "Quiet Shop",
          status: "active",
          health: {
            storeCount: 1,
            userCount: 1,
            productCount: 0,
            customerCount: 0,
            orderCount: 10,
            expenseCount: 0,
            purchaseCount: 0,
            inventoryMovementCount: 0,
            auditLogCount: 0,
            databaseBytes: 0,
            deviceCount: 1,
            lastOrderAt: "2026-06-01T12:00:00.000Z",
          },
        }),
        org({
          id: "c",
          name: "Suspended Co",
          status: "suspended",
          health: {
            storeCount: 1,
            userCount: 1,
            productCount: 0,
            customerCount: 0,
            orderCount: 5,
            expenseCount: 0,
            purchaseCount: 0,
            inventoryMovementCount: 0,
            auditLogCount: 0,
            databaseBytes: 0,
            deviceCount: 0,
            lastOrderAt: null,
          },
        }),
      ],
    });

    expect(glance.orgTotal).toBe(3);
    expect(glance.orgActive).toBe(2);
    expect(glance.orgSuspended).toBe(1);
    expect(glance.pendingInvites).toBe(3);
    expect(glance.orderTotal).toBe(115);
    expect(glance.quietOrgs).toBe(1);
    expect(glance.topOrgsByOrders[0]?.orders).toBe(100);
    expect(glance.statusChart).toEqual([
      { label: "نشطة", count: 2 },
      { label: "معلّقة", count: 1 },
    ]);
  });
});

describe("buildPlatformUsageGlance", () => {
  it("aggregates plan and pressure from usage matrix rows", () => {
    const rows = [
      {
        org_status: "active",
        plan: { plan: "starter" },
        pressure: { worst: "ok" },
      },
      {
        org_status: "active",
        plan: { plan: "growth" },
        pressure: { worst: "near" },
      },
      {
        org_status: "suspended",
        plan: { plan: "starter" },
        pressure: { worst: "over" },
      },
    ] as Pick<PlatformOrgUsageRow, "org_status" | "plan" | "pressure">[];

    const glance = buildPlatformUsageGlance(rows);
    expect(glance.total).toBe(3);
    expect(glance.ok).toBe(1);
    expect(glance.near).toBe(1);
    expect(glance.over).toBe(1);
    expect(glance.suspended).toBe(1);
    expect(glance.byPlanChart.find((r) => r.label === "Starter")?.count).toBe(2);
    expect(glance.byPressureChart.some((r) => r.label === "تجاوز")).toBe(true);
  });
});
