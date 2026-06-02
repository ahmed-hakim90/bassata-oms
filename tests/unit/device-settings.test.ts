import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import * as guards from "@/lib/auth/guards";
import * as deviceRepo from "@/lib/repositories/device.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { updateDevice } from "@/modules/system/services/users.service";
import { updateDeviceAction } from "@/modules/system/actions/system.actions";
import type { Device } from "@/lib/repositories/device.repository";

vi.mock("@/lib/auth/guards");
vi.mock("@/lib/repositories/device.repository");
vi.mock("@/lib/repositories/organization.repository", () => ({ getOrgId: vi.fn() }));
vi.mock("@/lib/services/audit.service", () => ({ writeAuditLog: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const updatedDevice: Device = {
  id: "device-1",
  store_id: "store-1",
  name: "Front Register",
  device_key_hash: "hash",
  is_active: true,
  last_seen_at: null,
};

describe("device settings updates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrgId).mockResolvedValue("org-1");
    vi.mocked(writeAuditLog).mockResolvedValue({
      id: "audit-1",
      org_id: "org-1",
      store_id: "store-1",
      user_id: "manager-1",
      action: "device.updated",
      entity_type: "device",
      entity_id: "device-1",
      metadata: {},
      created_at: new Date().toISOString(),
    });
    vi.mocked(guards.requirePermissionOrRole).mockResolvedValue({
      id: "manager-1",
      org_id: "org-1",
      auth_user_id: "auth-1",
      name: "Manager",
      email: "manager@test.com",
      role: "manager",
      is_active: true,
      store_ids: ["store-1"],
    });
  });

  it("returns the updated device and writes an audit log on successful rename", async () => {
    vi.mocked(deviceRepo.updateDevice).mockResolvedValue(updatedDevice);

    const result = await updateDevice("device-1", { name: "Front Register" }, "manager-1");

    expect(result).toEqual(updatedDevice);
    expect(deviceRepo.updateDevice).toHaveBeenCalledWith({
      id: "device-1",
      name: "Front Register",
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "device.updated",
        entityType: "device",
        entityId: "device-1",
      })
    );
  });

  it("throws when no device row is updated", async () => {
    vi.mocked(deviceRepo.updateDevice).mockResolvedValue(null);

    await expect(
      updateDevice("missing-device", { name: "Front Register" }, "manager-1")
    ).rejects.toThrow("Device not found or update not allowed");

    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it("checks settings permission and revalidates settings paths in update action", async () => {
    vi.mocked(deviceRepo.updateDevice).mockResolvedValue(updatedDevice);

    const result = await updateDeviceAction("device-1", { name: "Front Register" });

    expect(result).toEqual(updatedDevice);
    expect(guards.requirePermissionOrRole).toHaveBeenCalledWith("settings_manage", [
      "owner",
      "manager",
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/pos");
    expect(revalidatePath).toHaveBeenCalledWith("/device/pair");
  });
});
