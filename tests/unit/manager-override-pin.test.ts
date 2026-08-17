import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertManagerOverridePin } from "@/modules/pos/services/manager-override.service";
import { userRoleSupportsPin } from "@/lib/constants";
import { callRpc } from "@/lib/repositories/client";
import { getUser } from "@/lib/repositories/user.repository";

vi.mock("@/lib/repositories/client", () => ({
  callRpc: vi.fn(),
}));
vi.mock("@/lib/repositories/user.repository", () => ({
  getUser: vi.fn(),
}));

describe("assertManagerOverridePin", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects a missing PIN before calling the database", async () => {
    await expect(
      assertManagerOverridePin({ storeId: "s1", deviceId: "d1", pin: "  " })
    ).rejects.toThrow("أدخل PIN المالك أو المدير");
    expect(callRpc).not.toHaveBeenCalled();
  });

  it("allows PIN on owner and manager accounts, not inventory", () => {
    expect(userRoleSupportsPin("owner")).toBe(true);
    expect(userRoleSupportsPin("manager")).toBe(true);
    expect(userRoleSupportsPin("cashier")).toBe(true);
    expect(userRoleSupportsPin("inventory")).toBe(false);
  });

  it("maps invalid PIN errors to operator Arabic", async () => {
    vi.mocked(callRpc).mockResolvedValue({
      data: null,
      error: { message: "Invalid PIN" },
    });

    await expect(
      assertManagerOverridePin({ storeId: "s1", deviceId: "d1", pin: "1234" })
    ).rejects.toThrow("PIN المدير غلط");
  });

  it("returns the manager identity when the PIN matches a privileged user", async () => {
    vi.mocked(callRpc).mockResolvedValue({ data: "mgr-1", error: null });
    vi.mocked(getUser).mockResolvedValue({
      id: "mgr-1",
      name: "مدير الفرع",
      role: "manager",
      is_active: true,
    } as never);

    await expect(
      assertManagerOverridePin({ storeId: "s1", deviceId: "d1", pin: "1234" })
    ).resolves.toEqual({ managerId: "mgr-1", managerName: "مدير الفرع" });
  });
});
