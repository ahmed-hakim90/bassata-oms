import { describe, expect, it } from "vitest";
import { getPageAccessDenial } from "@/lib/auth/page-access";
import { filterNavByAccess } from "@/lib/auth/nav";

describe("wholesale sales-invoices access", () => {
  it("hides sales-invoices from nav when wholesale is disabled", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      {},
      { enableWholesaleSales: false }
    ).flatMap((g) => g.items.map((i) => i.href));

    expect(items).not.toContain("/sales-invoices");
  });

  it("shows sales-invoices when wholesale is enabled", () => {
    const items = filterNavByAccess(
      "owner",
      new Set(),
      {},
      { enableWholesaleSales: true }
    ).flatMap((g) => g.items.map((i) => i.href));

    expect(items).toContain("/sales-invoices");
  });

  it("denies page access when wholesale is disabled even with checkout_create", () => {
    const denial = getPageAccessDenial(
      "/sales-invoices",
      "manager",
      {},
      new Set(["checkout_create"]),
      { enableWholesaleSales: false }
    );
    expect(denial).not.toBeNull();
    expect(denial?.description).toMatch(/الجملة/);
  });

  it("allows page when wholesale is enabled and nav/permission permits", () => {
    const denial = getPageAccessDenial(
      "/sales-invoices",
      "owner",
      {},
      new Set(),
      { enableWholesaleSales: true }
    );
    expect(denial).toBeNull();
  });

  it("hides sales-invoices from cashier when allowCashierWholesale is false", () => {
    const items = filterNavByAccess(
      "cashier",
      new Set(),
      {},
      { enableWholesaleSales: true, allowCashierWholesale: false }
    ).flatMap((g) => g.items.map((i) => i.href));
    expect(items).not.toContain("/sales-invoices");

    const denial = getPageAccessDenial(
      "/sales-invoices",
      "cashier",
      {},
      new Set(["checkout_create"]),
      { enableWholesaleSales: true, allowCashierWholesale: false }
    );
    expect(denial?.description).toMatch(/الكاشير/);
  });

  it("shows sales-invoices for cashier when wholesale + cashier wholesale enabled", () => {
    const items = filterNavByAccess(
      "cashier",
      new Set(),
      {},
      { enableWholesaleSales: true, allowCashierWholesale: true }
    ).flatMap((g) => g.items.map((i) => i.href));
    expect(items).toContain("/sales-invoices");
  });
});
