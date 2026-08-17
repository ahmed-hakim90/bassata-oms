import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeSession } from "@/modules/sessions/services/session.service";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as vaultRepo from "@/lib/repositories/cashier-vault.repository";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId, getOrganization } from "@/lib/repositories/organization.repository";
import { getStore } from "@/lib/repositories/store.repository";
import { getUser } from "@/lib/repositories/user.repository";

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    fn();
  },
}));
vi.mock("@/lib/repositories/session.repository");
vi.mock("@/lib/repositories/cashier-vault.repository");
vi.mock("@/lib/services/period-lock.service", () => ({
  assertPeriodOpen: vi.fn(),
}));
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(),
  getOrganization: vi.fn(),
}));
vi.mock("@/lib/repositories/store.repository", () => ({ getStore: vi.fn() }));
vi.mock("@/lib/repositories/user.repository", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/services/email.service", () => ({
  notifyOwnersSessionClosed: vi.fn(),
}));

const closedSession = {
  id: "s1",
  store_id: "store1",
  device_id: null,
  cashier_id: "c1",
  opened_at: new Date().toISOString(),
  closed_at: new Date().toISOString(),
  opening_cash: 100,
  expected_cash: 140,
  actual_cash: 140,
  variance: 0,
  status: "closed" as const,
  notes: null,
  closed_by: "c1",
  close_reason: null,
  force_closed: false,
};

describe("closeSession vault retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(assertPeriodOpen).mockResolvedValue(undefined);
    vi.mocked(getOrgId).mockResolvedValue("org-1");
    vi.mocked(getOrganization).mockResolvedValue({ currency: "EGP" } as never);
    vi.mocked(getStore).mockResolvedValue({ name: "فرع" } as never);
    vi.mocked(getUser).mockResolvedValue({ name: "كاشير" } as never);
    vi.mocked(writeAuditLog).mockResolvedValue(undefined as never);
  });

  it("retries vault deposit when the session is already closed", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue(closedSession);
    vi.mocked(vaultRepo.depositClosing).mockResolvedValue({} as never);

    const result = await closeSession({
      sessionId: "s1",
      expectedCash: 140,
      actualCash: 140,
      userId: "c1",
    });

    expect(sessionRepo.closeSession).not.toHaveBeenCalled();
    expect(vaultRepo.depositClosing).toHaveBeenCalledWith({
      storeId: "store1",
      cashierId: "c1",
      amount: 140,
      sessionId: "s1",
    });
    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(result?.status).toBe("closed");
  });

  it("does not invite a second close when vault deposit fails after closing", async () => {
    vi.mocked(sessionRepo.getSession).mockResolvedValue({
      ...closedSession,
      status: "open",
      closed_at: null,
    });
    vi.mocked(sessionRepo.closeSession).mockResolvedValue(closedSession);
    vi.mocked(vaultRepo.depositClosing).mockRejectedValue(new Error("vault down"));

    await expect(
      closeSession({
        sessionId: "s1",
        expectedCash: 140,
        actualCash: 140,
        userId: "c1",
      })
    ).rejects.toThrow(/متكررش الإغلاق/);
  });
});
