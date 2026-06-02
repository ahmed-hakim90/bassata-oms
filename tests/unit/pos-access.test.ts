import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolvePosAccess, PosAccessError } from "@/lib/auth/pos-access";
import * as guards from "@/lib/auth/guards";
import * as session from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";

vi.mock("@/lib/auth/guards");
vi.mock("@/lib/auth/session");
vi.mock("@/lib/repositories/device.repository");

const managerUser = {
  id: "mgr-1",
  org_id: "org-1",
  auth_user_id: "auth-mgr",
  name: "Manager",
  email: "mgr@test.com",
  role: "manager" as const,
  is_active: true,
  store_ids: ["store-1"],
};

describe("resolvePosAccess pos_access permission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(session.getActiveStoreId).mockResolvedValue("store-1");
    vi.mocked(guards.requireStoreAccess).mockResolvedValue(managerUser);
    vi.mocked(session.getRegisteredDeviceContext).mockResolvedValue({
      deviceId: "dev-1",
      storeId: "store-1",
    });
    vi.mocked(deviceRepo.getDevice).mockResolvedValue({
      id: "dev-1",
      store_id: "store-1",
      name: "Register 1",
      is_active: true,
      device_key_hash: "x",
      last_seen_at: null,
    });
    vi.mocked(deviceRepo.touchDeviceSeen).mockResolvedValue(undefined);
    vi.mocked(session.getActiveCashierId).mockResolvedValue("mgr-1");
  });

  it("denies when pos_access permission check fails", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(managerUser);
    vi.mocked(guards.requirePermissionOrRole).mockRejectedValue(
      new guards.AuthError("Insufficient permissions")
    );

    await expect(resolvePosAccess()).rejects.toMatchObject({
      code: "role_denied",
    } satisfies Partial<PosAccessError>);
  });

  it("allows when pos_access permission passes", async () => {
    vi.mocked(guards.requireAuth).mockResolvedValue(managerUser);
    vi.mocked(guards.requirePermissionOrRole).mockResolvedValue(managerUser);

    const ctx = await resolvePosAccess();
    expect(ctx.storeId).toBe("store-1");
    expect(ctx.deviceId).toBe("dev-1");
    expect(guards.requirePermissionOrRole).toHaveBeenCalledWith("pos_access", [
      "owner",
      "manager",
      "cashier",
    ]);
  });
});
