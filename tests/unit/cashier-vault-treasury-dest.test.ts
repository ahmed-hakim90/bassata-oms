import { beforeEach, describe, expect, it, vi } from "vitest";
import { withdrawFromCashierVault } from "@/modules/sessions/services/cashier-vault.service";
import * as vaultRepo from "@/lib/repositories/cashier-vault.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";

vi.mock("@/lib/repositories/cashier-vault.repository");
vi.mock("@/lib/services/period-lock.service", () => ({
  assertPeriodOpen: vi.fn().mockResolvedValue(undefined),
}));

describe("cashier vault admin withdraw → treasury", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
  });

  it("forwards destinationTreasuryId to the withdraw RPC (does not vanish cash)", async () => {
    vi.mocked(vaultRepo.getVault).mockResolvedValue({
      id: "v1",
      balance: 1000,
      pending_opening_float: 200,
    } as never);
    vi.mocked(vaultRepo.adminWithdraw).mockResolvedValue({
      id: "v1",
      balance: 200,
    } as never);

    await withdrawFromCashierVault({
      storeId: "store-1",
      cashierId: "cashier-1",
      withdrawAmount: 800,
      nextOpeningFloat: 200,
      destinationTreasuryId: "treasury-store-1",
      notes: "توريد",
    });

    expect(vaultRepo.adminWithdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationTreasuryId: "treasury-store-1",
        withdrawAmount: 800,
        nextOpeningFloat: 200,
      })
    );
  });
});
