import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertPeriodOpen,
  PeriodClosedError,
} from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/inventory.repository", () => ({
  isPeriodClosed: vi.fn(),
}));

vi.mock("@/lib/repositories/closing.repository", () => ({
  findClosedPeriod: vi.fn(),
}));

import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as closingRepo from "@/lib/repositories/closing.repository";

describe("assertPeriodOpen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows operations when period is open", async () => {
    vi.mocked(inventoryRepo.isPeriodClosed).mockResolvedValue(false);
    await expect(assertPeriodOpen("store-1")).resolves.toBeUndefined();
  });

  it("blocks operations when period is closed", async () => {
    vi.mocked(inventoryRepo.isPeriodClosed).mockResolvedValue(true);
    vi.mocked(closingRepo.findClosedPeriod).mockResolvedValue({
      id: "c1",
      org_id: "o1",
      store_id: "store-1",
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      status: "closed",
      summary: {},
      closed_by: "u1",
      closed_at: "2026-08-01T00:00:00Z",
    });

    await expect(assertPeriodOpen("store-1", "2026-07-15T12:00:00Z")).rejects.toBeInstanceOf(
      PeriodClosedError
    );
  });
});
