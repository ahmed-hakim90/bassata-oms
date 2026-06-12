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

describe("requirePermissionOrRole RBAC seeding", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(userRepo.getUserByAuthId).mockResolvedValue(managerUser);
  });

  it("denies manager when RBAC seeded and permission revoked", async () => {
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);
    vi.mocked(permissionRepo.isRbacSeeded).mockResolvedValue(true);

    await expect(
      requirePermissionOrRole("pos_access", ["owner", "manager", "cashier"])
    ).rejects.toThrow("Insufficient permissions");
  });

  it("allows manager via role fallback when RBAC not seeded", async () => {
    vi.mocked(permissionRepo.hasPermission).mockResolvedValue(false);
    vi.mocked(permissionRepo.isRbacSeeded).mockResolvedValue(false);

    const user = await requirePermissionOrRole("pos_access", [
      "owner",
      "manager",
      "cashier",
    ]);
    expect(user.role).toBe("manager");
  });
});
