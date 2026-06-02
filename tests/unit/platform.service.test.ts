import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const storageFromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  })),
}));

describe("platform service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageFromMock.mockReturnValue({
      list: vi.fn(async () => ({
        data: [{ metadata: { size: 128 } }, { metadata: { size: 256 } }],
        error: null,
      })),
    });
  });

  it("maps company metrics from RPC and storage", async () => {
    rpcMock.mockResolvedValue({
      data: {
        store_count: 2,
        user_count: 5,
        product_count: 20,
        customer_count: 9,
        order_count: 40,
        expense_count: 3,
        purchase_count: 4,
        inventory_movement_count: 80,
        audit_log_count: 10,
        database_bytes: 12345,
      },
      error: null,
    });

    const { getCompanyMetrics } = await import("@/modules/platform/services/platform.service");
    await expect(getCompanyMetrics("org-1")).resolves.toMatchObject({
      storeCount: 2,
      userCount: 5,
      productCount: 20,
      databaseBytes: 12345,
      storageBytes: 384,
    });
  });

  it("rejects expired invite tokens and marks them expired", async () => {
    const updateMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "invite-1",
              token_hash: "hash",
              org_name: "Acme",
              owner_name: "Owner",
              owner_email: "owner@example.com",
              status: "pending",
              expires_at: new Date(Date.now() - 1000).toISOString(),
              accepted_org_id: null,
              created_by: "platform-1",
              revoked_by: null,
              accepted_at: null,
              revoked_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });
    fromMock.mockReturnValueOnce({ update: updateMock });

    const { getPendingInviteByToken } = await import("@/modules/platform/services/platform.service");
    await expect(getPendingInviteByToken("token")).resolves.toBeNull();
    expect(updateMock).toHaveBeenCalledWith({
      status: "expired",
      updated_at: expect.any(String),
    });
  });
});
