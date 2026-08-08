import { describe, expect, it, vi } from "vitest";
import {
  isReservedHostname,
  isValidCustomDomainHostname,
  normalizeHostname,
} from "@/lib/tenancy/custom-domain";
import { assertCustomerCreditCapacity } from "@/modules/customers/lib/credit-limit";
describe("custom domain hostname rules", () => {
  it("normalizes hostnames", () => {
    expect(normalizeHostname("https://POS.Client.COM/path")).toBe("pos.client.com");
    expect(normalizeHostname("pos.client.com:443")).toBe("pos.client.com");
  });

  it("rejects reserved and invalid hosts", () => {
    expect(isReservedHostname("localhost")).toBe(true);
    expect(isReservedHostname("foo.vercel.app")).toBe(true);
    expect(isValidCustomDomainHostname("not a host")).toBe(false);
    expect(isValidCustomDomainHostname("pos.example.com")).toBe(true);
  });

  it("denies cross-tenant host binding (user org ≠ host org)", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () =>
        new Headers({
          "x-host-org-id": "org-b",
        }),
      cookies: async () => ({
        get: () => undefined,
      }),
    }));
    const { assertUserMatchesHostOrg } = await import(
      "@/lib/tenancy/host-org-session"
    );
    await expect(assertUserMatchesHostOrg("org-a")).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("دومين"),
    });
    vi.doUnmock("next/headers");
  });

  it("allows matching host org", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () =>
        new Headers({
          "x-host-org-id": "org-a",
        }),
      cookies: async () => ({
        get: () => undefined,
      }),
    }));
    const { assertUserMatchesHostOrg } = await import(
      "@/lib/tenancy/host-org-session"
    );
    await expect(assertUserMatchesHostOrg("org-a")).resolves.toBeUndefined();
    vi.doUnmock("next/headers");
  });
});

describe("assertCustomerCreditCapacity", () => {
  it("allows when limit is zero (unlimited)", () => {
    expect(() =>
      assertCustomerCreditCapacity({
        accountBalance: 1000,
        creditLimit: 0,
        additionalCharge: 500,
      })
    ).not.toThrow();
  });

  it("blocks when next balance exceeds limit with remaining capacity", () => {
    expect(() =>
      assertCustomerCreditCapacity({
        accountBalance: 800,
        creditLimit: 1000,
        additionalCharge: 300,
      })
    ).toThrow(/المتاح الآن 200/);
  });
});
