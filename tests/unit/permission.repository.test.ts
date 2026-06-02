import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasPermission } from "@/lib/repositories/permission.repository";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: mockRpc,
  })),
}));

describe("permission.repository hasPermission", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns true when RPC grants permission", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await expect(hasPermission("pos_access")).resolves.toBe(true);
  });

  it("returns false when RPC denies permission", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(hasPermission("pos_access")).resolves.toBe(false);
  });

  it("throws when RPC fails unexpectedly", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom", code: "XX000" } });
    await expect(hasPermission("pos_access")).rejects.toThrow();
  });
});
