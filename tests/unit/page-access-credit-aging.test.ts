import { describe, expect, it } from "vitest";
import { filterNavByAccess } from "@/lib/auth/nav";
import { getPageAccessDenial } from "@/lib/auth/page-access";

describe("aging report credit_sales gate", () => {
  it("keeps aging nav when credit_sales is off (supplier AP still available)", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      { reports: true, credit_sales: false }
    ).flatMap((g) => g.items.map((i) => i.href));
    expect(items).toContain("/reports/aging");
  });

  it("shows aging when credit_sales is on", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      { reports: true, credit_sales: true }
    ).flatMap((g) => g.items.map((i) => i.href));
    expect(items).toContain("/reports/aging");
  });

  it("allows aging page when credit_sales is off", () => {
    const denial = getPageAccessDenial(
      "/reports/aging",
      "owner",
      { reports: true, credit_sales: false },
      new Set()
    );
    expect(denial).toBeNull();
  });
});
