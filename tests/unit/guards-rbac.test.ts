import { describe, expect, it, vi, beforeEach } from "vitest";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import * as userRepo from "@/lib/repositories/user.repository";

vi.mock("@/lib/repositories/permission.repository");
vi.mock("@/lib/repositories/user.repository");
vi.mock("@/lib/org-status", () => ({
  isOrganizationSuspended: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-1" } } }),
    },
  })),
}));

const managerUser = {
  id: "u1",
  auth_user_id: "auth-1",
  org_id: "org1",
  email: "m@x.com",
  name: "Manager",
  role: "manager" as const,
  is_active: true,
  store_ids: [] as string[],
};

const inventoryUser = {
  ...managerUser,
  id: "u2",
  email: "inv@x.com",
  name: "Inventory",
  role: "inventory" as const,
};

describe("requirePermissionOrRole", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows manager via explicit role allow-list even when permission is false", async () => {
    vi.mocked(userRepo.getUserByAuthId).mockResolvedValue(managerUser);
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);

    const user = await requirePermissionOrRole("pos_access", [
      "owner",
      "manager",
      "cashier",
    ]);
    expect(user.role).toBe("manager");
  });

  it("denies role outside allow-list when permission is false", async () => {
    vi.mocked(userRepo.getUserByAuthId).mockResolvedValue(inventoryUser);
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);

    await expect(
      requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"])
    ).rejects.toThrow("مفيش صلاحية للعملية دي");
  });

  it("allows role outside allow-list when permission is granted", async () => {
    vi.mocked(userRepo.getUserByAuthId).mockResolvedValue(inventoryUser);
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(true);

    const user = await requirePermissionOrRole("pos_access", [
      "owner",
      "manager",
      "cashier",
    ]);
    expect(user.role).toBe("inventory");
  });
});
