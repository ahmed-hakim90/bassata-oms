import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  closeSessionAction,
  forceCloseSessionAction,
} from "@/modules/sessions/actions/session.actions";
import * as guards from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import * as sessionService from "@/modules/sessions/services/session.service";
import * as reconciliation from "@/modules/sessions/services/reconciliation.service";
import * as settingsService from "@/modules/system/services/settings.service";
import * as posAccess from "@/lib/auth/pos-access";

vi.mock("@/lib/auth/guards");
vi.mock("@/lib/auth/pos-access");
vi.mock("@/lib/auth/session");
vi.mock("@/lib/repositories/permission.repository");
vi.mock("@/modules/sessions/services/session.service");
vi.mock("@/modules/sessions/services/reconciliation.service");
vi.mock("@/modules/system/services/settings.service");
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("forceCloseSessionAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(guards.requireAuth).mockResolvedValue({
      id: "manager-1",
      org_id: "org-1",
      auth_user_id: "auth-1",
      name: "Manager",
      email: "manager@test.com",
      role: "manager",
      is_active: true,
      store_ids: [],
    });
    vi.mocked(guards.requirePermissionOrRole).mockResolvedValue(undefined as never);
    vi.mocked(settingsService.getSessionSettings).mockResolvedValue({
      max_open_hours: 24,
      warn_after_hours: 20,
      block_sales_when_expired: true,
      require_manager_override_for_expired_sale: true,
      allow_manager_force_close: true,
      manager_discount_override_amount: null,
    });
    vi.mocked(reconciliation.calcExpectedCash).mockResolvedValue({
      openingCash: 100,
      cashSales: 50,
      cashRefunds: 0,
      expenses: 10,
      expectedCash: 140,
      totalSales: 50,
      orderCount: 1,
    });
  });

  it("requires a close reason", async () => {
    vi.mocked(sessionService.getSessionById).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "cashier-1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 100,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });

    await expect(
      forceCloseSessionAction({
        sessionId: "s1",
        actualCash: 140,
        closeReason: "   ",
      })
    ).rejects.toThrow("Close reason is required");
  });

  it("rejects when manager force close is disabled", async () => {
    vi.mocked(settingsService.getSessionSettings).mockResolvedValue({
      max_open_hours: 24,
      warn_after_hours: 20,
      block_sales_when_expired: true,
      require_manager_override_for_expired_sale: true,
      allow_manager_force_close: false,
      manager_discount_override_amount: null,
    });

    await expect(
      forceCloseSessionAction({
        sessionId: "s1",
        actualCash: 140,
        closeReason: "Cashier left",
      })
    ).rejects.toThrow("Manager force close is disabled in settings");
  });

  it("force closes an open session with audit metadata path", async () => {
    vi.mocked(sessionService.getSessionById).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "cashier-1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 100,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });
    vi.mocked(sessionService.forceCloseSession).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "cashier-1",
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      opening_cash: 100,
      expected_cash: 140,
      actual_cash: 138,
      variance: -2,
      status: "closed",
      notes: null,
      closed_by: "manager-1",
      close_reason: "Cashier left",
      force_closed: true,
    });

    const result = await forceCloseSessionAction({
      sessionId: "s1",
      actualCash: 138,
      closeReason: "Cashier left",
    });

    expect(result?.force_closed).toBe(true);
    expect(sessionService.forceCloseSession).toHaveBeenCalledWith({
      sessionId: "s1",
      expectedCash: 140,
      actualCash: 138,
      closeReason: "Cashier left",
      notes: undefined,
      userId: "manager-1",
    });
    expect(guards.requirePermissionOrRole).toHaveBeenCalledWith("session_force_close", [
      "owner",
      "manager",
    ]);
  });
});

describe("closeSessionAction authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(reconciliation.calcExpectedCash).mockResolvedValue({
      openingCash: 0,
      cashSales: 0,
      cashRefunds: 0,
      expenses: 0,
      expectedCash: 0,
      totalSales: 0,
      orderCount: 0,
    });
  });

  it("denies closing another cashier session without force permission", async () => {
    vi.mocked(posAccess.getPosAccessOrNull).mockResolvedValue({
      user: {
        id: "cashier-2",
        org_id: "org-1",
        auth_user_id: "auth-2",
        name: "Cashier 2",
        email: "cashier2@test.com",
        role: "cashier",
        is_active: true,
        store_ids: [],
      },
      storeId: "store1",
      deviceId: "dev-1",
      activeCashierId: "cashier-2",
    });
    vi.mocked(guards.requireAuth).mockResolvedValue({
      id: "cashier-2",
      org_id: "org-1",
      auth_user_id: "auth-2",
      name: "Cashier 2",
      email: "cashier2@test.com",
      role: "cashier",
      is_active: true,
      store_ids: [],
    });
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);
    vi.mocked(sessionService.getSessionById).mockResolvedValue({
      id: "s1",
      store_id: "store1",
      device_id: null,
      cashier_id: "cashier-1",
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash: 0,
      expected_cash: null,
      actual_cash: null,
      variance: null,
      status: "open",
      notes: null,
      closed_by: null,
      close_reason: null,
      force_closed: false,
    });

    await expect(
      closeSessionAction({ sessionId: "s1", actualCash: 0 })
    ).rejects.toThrow("You can only close your own session");
  });
});
