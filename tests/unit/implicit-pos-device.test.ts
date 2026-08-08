import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureImplicitPosDeviceBinding } from "@/lib/auth/implicit-pos-device";
import * as session from "@/lib/auth/session";
import * as deviceRepo from "@/lib/repositories/device.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as usersService from "@/modules/system/services/users.service";

vi.mock("@/lib/auth/resume-pos-session", () => ({
  resumePosSessionForUser: vi.fn().mockResolvedValue("store-1"),
}));
vi.mock("@/lib/auth/guards", () => ({
  setActiveStoreCookie: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth/session");
vi.mock("@/lib/repositories/device.repository");
vi.mock("@/lib/repositories/store.repository");
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn().mockResolvedValue("org-1"),
}));
vi.mock("@/lib/services/audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/system/services/users.service");

const cashier = {
  id: "user-1",
  org_id: "org-1",
  auth_user_id: "auth-1",
  name: "Cashier",
  email: "c@test.com",
  role: "cashier" as const,
  is_active: true,
  store_ids: ["store-1"],
};

describe("ensureImplicitPosDeviceBinding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(storeRepo.listStores).mockResolvedValue([
      {
        id: "store-1",
        org_id: "org-1",
        name: "Main",
        code: "M",
        address: null,
        phone: null,
        is_active: true,
        created_at: "",
        updated_at: "",
      } as never,
    ]);
    vi.mocked(session.getActiveStoreId).mockResolvedValue("store-1");
    vi.mocked(session.getRegisteredDeviceContext).mockResolvedValue(null);
    vi.mocked(session.setRegisteredDeviceCookie).mockResolvedValue(undefined);
    vi.mocked(session.setActiveCashierId).mockResolvedValue(undefined);
    vi.mocked(session.clearRegisteredDeviceCookie).mockResolvedValue(undefined);
    vi.mocked(deviceRepo.cashierCanUseDevice).mockResolvedValue(true);
  });

  it("binds existing active device without creating", async () => {
    vi.mocked(deviceRepo.listDevices).mockResolvedValue([
      {
        id: "dev-1",
        store_id: "store-1",
        name: "كاشير رئيسي",
        device_key_hash: "x",
        is_active: true,
        last_seen_at: null,
        scale_enabled: false,
        scale_settings: {},
      },
    ]);

    const result = await ensureImplicitPosDeviceBinding(cashier);

    expect(result).toEqual({
      ok: true,
      storeId: "store-1",
      deviceId: "dev-1",
      createdDevice: false,
    });
    expect(usersService.createDevice).not.toHaveBeenCalled();
    expect(session.setRegisteredDeviceCookie).toHaveBeenCalledWith({
      deviceId: "dev-1",
      storeId: "store-1",
    });
    expect(session.setActiveCashierId).not.toHaveBeenCalled();
  });

  it("creates default device when store has none", async () => {
    vi.mocked(deviceRepo.listDevices).mockResolvedValue([]);
    vi.mocked(usersService.createDevice).mockResolvedValue({
      id: "dev-new",
      store_id: "store-1",
      name: "كاشير رئيسي",
      device_key_hash: "x",
      is_active: true,
      last_seen_at: null,
      scale_enabled: false,
      scale_settings: {},
    });

    const result = await ensureImplicitPosDeviceBinding(cashier);

    expect(result).toEqual({
      ok: true,
      storeId: "store-1",
      deviceId: "dev-new",
      createdDevice: true,
    });
    expect(usersService.createDevice).toHaveBeenCalledWith(
      { storeId: "store-1", name: "كاشير رئيسي" },
      "user-1"
    );
  });
});
