import { describe, expect, it } from "vitest";
import type { PermissionKey } from "@/lib/constants";
import { getFilteredModuleHub } from "@/modules/module-hubs/lib/filter-module-hub";

describe("module hub catalogs", () => {
  it("filters purchasing links when purchases flag is off", () => {
    const hub = getFilteredModuleHub("purchasing", "owner", new Set(), {
      purchases: false,
    });
    expect(hub.links).toEqual([]);
  });

  it("keeps operations hub usable for cashier legacy", () => {
    const hub = getFilteredModuleHub("operations", "cashier", new Set(), {}, {
      enableKitchenDisplay: true,
    });
    expect(hub.links.map((l) => l.href)).toEqual(
      expect.arrayContaining(["/pos", "/orders", "/sessions"])
    );
  });

  it("hides sales-documents hub cards when wholesale is off", () => {
    const hub = getFilteredModuleHub(
      "sales-documents",
      "owner",
      new Set(),
      {},
      { enableWholesaleSales: false }
    );
    expect(hub.links).toEqual([]);
  });

  it("shows catalog products for inventory with product_manage", () => {
    const permissions = new Set<PermissionKey>(["product_manage"]);
    const hub = getFilteredModuleHub("catalog", "inventory", permissions);
    expect(hub.links.map((l) => l.href)).toContain("/products");
  });

  it("hides import links unless purchase_imports is on", () => {
    const off = getFilteredModuleHub("purchasing", "owner", new Set(), {
      purchases: true,
      purchase_imports: false,
    });
    expect(off.links.map((l) => l.href)).not.toContain("/inventory/containers");
    expect(off.links.map((l) => l.href)).not.toContain(
      "/inventory/customs-certificates"
    );

    const on = getFilteredModuleHub("purchasing", "owner", new Set(), {
      purchases: true,
      purchase_imports: true,
    });
    expect(on.links.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        "/inventory/containers",
        "/inventory/customs-certificates",
      ])
    );
  });

  it("includes accounting and customers hub landings", () => {
    const accounting = getFilteredModuleHub("accounting", "owner", new Set(), {
      general_ledger: true,
      session_expenses: true,
      monthly_closing: true,
    });
    expect(accounting.links.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        "/accounting/accounts",
        "/accounting/journals",
        "/expenses",
      ])
    );

    const customers = getFilteredModuleHub("customers", "owner", new Set(), {
      loyalty: true,
      promotions: true,
      credit_sales: true,
      reports: true,
    });
    expect(customers.links.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        "/customers/directory",
        "/customers/loyalty",
        "/promotions",
      ])
    );
  });
});
