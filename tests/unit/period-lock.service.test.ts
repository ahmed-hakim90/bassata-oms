import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeriodClosedError, assertPeriodOpen } from "@/lib/services/period-lock.service";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as closingRepo from "@/lib/repositories/closing.repository";

vi.mock("@/lib/repositories/inventory.repository");
vi.mock("@/lib/repositories/closing.repository");

describe("assertPeriodOpen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows operations when period is open", async () => {
    vi.mocked(inventoryRepo.isPeriodClosed).mockResolvedValue(false);
    await expect(assertPeriodOpen("store-1")).resolves.toBeUndefined();
  });

  it("throws PeriodClosedError when period is closed", async () => {
    vi.mocked(inventoryRepo.isPeriodClosed).mockResolvedValue(true);
    vi.mocked(closingRepo.findClosedPeriod).mockResolvedValue({
      id: "close-1",
      org_id: "org-1",
      store_id: "store-1",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      status: "closed",
      summary: {},
      closed_by: "user-1",
      closed_at: new Date().toISOString(),
    });

    await expect(assertPeriodOpen("store-1")).rejects.toBeInstanceOf(PeriodClosedError);
  });
});
