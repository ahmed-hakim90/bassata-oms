import { describe, expect, it } from "vitest";
import { getPageAccessDenial } from "@/lib/auth/page-access";
import { filterNavByAccess } from "@/lib/auth/nav";

describe("kitchen display activity access", () => {
  it("hides kitchen from nav when food-service is disabled", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      {},
      { enableKitchenDisplay: false }
    ).flatMap((g) => g.items.map((i) => i.href));

    expect(items).not.toContain("/kitchen");
  });

  it("shows kitchen when food-service is enabled", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      {},
      { enableKitchenDisplay: true }
    ).flatMap((g) => g.items.map((i) => i.href));

    expect(items).toContain("/kitchen");
  });

  it("denies page access when kitchen is disabled even with order_view", () => {
    const denial = getPageAccessDenial(
      "/kitchen",
      "manager",
      {},
      new Set(["order_view"]),
      { enableKitchenDisplay: false }
    );
    expect(denial).not.toBeNull();
    expect(denial?.title).toBe("شاشة المطبخ");
    expect(denial?.description).toMatch(/تحضير/);
  });

  it("allows kitchen page when food-service is enabled", () => {
    const denial = getPageAccessDenial(
      "/kitchen",
      "owner",
      {},
      new Set(),
      { enableKitchenDisplay: true }
    );
    expect(denial).toBeNull();
  });
});
