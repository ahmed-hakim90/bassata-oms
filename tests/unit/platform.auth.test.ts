import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: authMock,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

vi.mock("@/lib/platform/bootstrap", () => ({
  isPlatformBootstrapEmail: vi.fn((email: string) => email === "admin@example.com"),
}));

function selectMaybeSingle(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data, error: null }),
      }),
    }),
  };
}

describe("platform admin auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      data: { user: { id: "auth-1", email: "admin@example.com", user_metadata: {} } },
    });
  });

  it("allows active platform admin rows", async () => {
    fromMock.mockImplementation(() =>
      selectMaybeSingle({
        id: "platform-1",
        auth_user_id: "auth-1",
        email: "admin@example.com",
        name: "Admin",
        is_active: true,
      })
    );

    const { requirePlatformAdmin } = await import("@/lib/platform/auth");
    await expect(requirePlatformAdmin()).resolves.toMatchObject({
      id: "platform-1",
      email: "admin@example.com",
    });
  });

  it("rejects signed-in users who are not platform admins", async () => {
    authMock.mockResolvedValue({
      data: { user: { id: "auth-2", email: "user@example.com", user_metadata: {} } },
    });
    fromMock.mockImplementation(() => selectMaybeSingle(null));

    const { requirePlatformAdmin } = await import("@/lib/platform/auth");
    await expect(requirePlatformAdmin()).rejects.toThrow("Platform admin access required");
  });
});
