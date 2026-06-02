import { describe, expect, it, vi, beforeEach } from "vitest";
import { userHasPermission } from "@/modules/accounting/services/permission.service";
import * as permissionRepo from "@/lib/repositories/permission.repository";

vi.mock("@/lib/repositories/permission.repository");

describe("userHasPermission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("owner always has permission", async () => {
    const allowed = await userHasPermission("u1", "owner", "settings_manage");
    expect(allowed).toBe(true);
  });

  it("respects user override grant", async () => {
    vi.mocked(permissionRepo.getUserPermissionGrants).mockResolvedValue([
      { permission_key: "reports_view", granted: true },
    ]);
    vi.mocked(permissionRepo.getPermissionsForRole).mockResolvedValue([]);

    const allowed = await userHasPermission("u2", "cashier", "reports_view");
    expect(allowed).toBe(true);
  });

  it("falls back to role permissions", async () => {
    vi.mocked(permissionRepo.getUserPermissionGrants).mockResolvedValue([]);
    vi.mocked(permissionRepo.getPermissionsForRole).mockResolvedValue(["inventory_view"]);

    const allowed = await userHasPermission("u3", "inventory", "inventory_view");
    expect(allowed).toBe(true);
  });

  it("includes new session permissions in role catalog", async () => {
    vi.mocked(permissionRepo.getUserPermissionGrants).mockResolvedValue([]);
    vi.mocked(permissionRepo.getPermissionsForRole).mockResolvedValue([
      "session_view_all",
      "session_force_close",
      "session_settings_manage",
    ]);

    await expect(userHasPermission("u4", "manager", "session_force_close")).resolves.toBe(true);
    await expect(userHasPermission("u4", "manager", "session_settings_manage")).resolves.toBe(true);
  });
});
