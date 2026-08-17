import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  transferBetweenTreasuries,
  sweepClosedPeriodToHq,
} from "@/modules/treasury/services/treasury.service";
import * as treasuryRepo from "@/lib/repositories/cash-treasury.repository";
import * as closingRepo from "@/lib/repositories/closing.repository";

vi.mock("@/lib/repositories/cash-treasury.repository");
vi.mock("@/lib/repositories/closing.repository");
vi.mock("@/lib/repositories/store.repository", () => ({
  listStores: vi.fn().mockResolvedValue([{ id: "store-1", name: "فرع" }]),
}));

describe("treasury.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects non-positive transfer amounts", async () => {
    await expect(
      transferBetweenTreasuries({
        fromTreasuryId: "a",
        toTreasuryId: "b",
        amount: 0,
      })
    ).rejects.toThrow(/مبلغ/);
    expect(treasuryRepo.transfer).not.toHaveBeenCalled();
  });

  it("transfers rounded amounts through the repository", async () => {
    vi.mocked(treasuryRepo.transfer).mockResolvedValue("b");
    await transferBetweenTreasuries({
      fromTreasuryId: "a",
      toTreasuryId: "b",
      amount: 12.345,
      notes: "توريد",
    });
    expect(treasuryRepo.transfer).toHaveBeenCalledWith({
      fromTreasuryId: "a",
      toTreasuryId: "b",
      amount: 12.35,
      notes: "توريد",
    });
  });

  it("blocks period sweep unless the monthly close is closed", async () => {
    vi.mocked(closingRepo.getClosing).mockResolvedValue({
      id: "p1",
      status: "draft",
      store_id: "store-1",
    } as never);

    await expect(
      sweepClosedPeriodToHq({ storeId: "store-1", periodId: "p1" })
    ).rejects.toThrow(/مقفولة/);
    expect(treasuryRepo.periodSweep).not.toHaveBeenCalled();
  });

  it("sweeps a closed period to HQ", async () => {
    vi.mocked(closingRepo.getClosing).mockResolvedValue({
      id: "p1",
      status: "closed",
      store_id: "store-1",
    } as never);
    vi.mocked(treasuryRepo.periodSweep).mockResolvedValue(500);

    await expect(
      sweepClosedPeriodToHq({ storeId: "store-1", periodId: "p1" })
    ).resolves.toBe(500);
  });

  it("rejects a second sweep when the repository reports the unique conflict", async () => {
    vi.mocked(closingRepo.getClosing).mockResolvedValue({
      id: "p1",
      status: "closed",
      store_id: "store-1",
    } as never);
    vi.mocked(treasuryRepo.periodSweep).mockRejectedValue(
      new Error("الفترة دي اتسحبت قبل كده للخزينة الرئيسية")
    );

    await expect(
      sweepClosedPeriodToHq({ storeId: "store-1", periodId: "p1" })
    ).rejects.toThrow(/اتسحبت/);
  });
});
