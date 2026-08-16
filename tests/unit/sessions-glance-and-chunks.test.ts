import { describe, expect, it } from "vitest";
import { chunkIds, SUPABASE_IN_CHUNK } from "@/lib/query-chunks";
import { buildSessionsGlance } from "@/modules/sessions/lib/sessions-glance";
import type { CashierSession } from "@/lib/types";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";

describe("chunkIds", () => {
  it("returns empty for empty input", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("keeps small lists as a single chunk", () => {
    expect(chunkIds(["a", "b"], 200)).toEqual([["a", "b"]]);
  });

  it("splits at chunk size", () => {
    const ids = Array.from({ length: SUPABASE_IN_CHUNK + 3 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(SUPABASE_IN_CHUNK);
    expect(chunks[1]).toHaveLength(3);
  });
});

describe("buildSessionsGlance", () => {
  const baseSession = {
    org_id: "o1",
    store_id: "s1",
    device_id: null,
    opening_cash: 0,
    expected_cash: null,
    actual_cash: null,
    notes: "",
    closed_by: null,
    close_reason: null,
    force_closed: false,
  };

  it("aggregates open sales and closed variance without inventing rows", () => {
    const now = Date.now();
    const closedSessions = [
      {
        ...baseSession,
        id: "c1",
        cashier_id: "u1",
        status: "closed",
        opened_at: new Date(now - 2 * 86400000).toISOString(),
        closed_at: new Date(now - 2 * 86400000).toISOString(),
        variance: 10,
      },
      {
        ...baseSession,
        id: "c2",
        cashier_id: "u1",
        status: "closed",
        opened_at: new Date(now - 1 * 86400000).toISOString(),
        closed_at: new Date(now - 1 * 86400000).toISOString(),
        variance: -3,
      },
      {
        ...baseSession,
        id: "c3",
        cashier_id: "u2",
        status: "closed",
        opened_at: new Date(now - 40 * 86400000).toISOString(),
        closed_at: new Date(now - 40 * 86400000).toISOString(),
        variance: 100,
      },
    ] as CashierSession[];

    const openSummaries = [
      { totalSales: 200 },
      { totalSales: 50 },
    ] as OpenSessionSummary[];

    const glance = buildSessionsGlance({
      openSummaries,
      closedSessions,
      userMap: { u1: "أحمد", u2: "سارة" },
      days: 30,
    });

    expect(glance.openCount).toBe(2);
    expect(glance.openSalesTotal).toBe(250);
    expect(glance.closed30dCount).toBe(2);
    expect(glance.variance30d).toBe(7);
    expect(glance.varianceChart).toEqual([{ label: "أحمد", variance: 7 }]);
  });
});
