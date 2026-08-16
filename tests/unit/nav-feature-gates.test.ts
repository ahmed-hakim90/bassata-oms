import { describe, expect, it } from "vitest";
import { filterNavByAccess } from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey } from "@/lib/constants";

function hrefs(
  role: "owner" | "manager" | "cashier" | "inventory",
  flags?: Partial<Record<FeatureFlag, boolean>>,
  permissions: PermissionKey[] = []
) {
  return filterNavByAccess(role, new Set(permissions), flags).flatMap((g) =>
    g.items.map((i) => i.href)
  );
}

function groupHrefs(
  role: "owner" | "manager" | "cashier" | "inventory",
  groupLabel: string,
  flags?: Partial<Record<FeatureFlag, boolean>>,
  permissions: PermissionKey[] = []
) {
  const group = filterNavByAccess(role, new Set(permissions), flags).find(
    (g) => g.label === groupLabel
  );
  return group?.items.map((i) => i.href) ?? [];
}

describe("S08 nav feature gates", () => {
  it("hides purchases/suppliers when purchases flag is false", () => {
    const items = hrefs("owner", { purchases: false });
    expect(items).not.toContain("/inventory/purchases");
    expect(items).not.toContain("/inventory/suppliers");
  });

  it("hides inventory modules when their flags are false", () => {
    const items = hrefs("owner", {
      transfers: false,
      waste: false,
      stock_count: false,
    });
    expect(items).not.toContain("/inventory/transfers");
    expect(items).not.toContain("/inventory/waste");
    expect(items).not.toContain("/inventory/stock-count");
  });

  it("hides loyalty and expenses when flags are false", () => {
    const items = hrefs("owner", { loyalty: false, session_expenses: false });
    expect(items).not.toContain("/customers/loyalty");
    expect(items).not.toContain("/expenses");
  });

  it("hides promotions when promotions flag is false", () => {
    const items = hrefs("owner", { promotions: false });
    expect(items).not.toContain("/promotions");
  });

  it("shows promotions when flag is true", () => {
    const items = hrefs("owner", { promotions: true }, ["manage_promotions"]);
    expect(items).toContain("/promotions");
  });

  it("hides all report routes when reports flag is false", () => {
    const items = hrefs("owner", { reports: false });
    expect(items.filter((h) => h.startsWith("/reports"))).toEqual([]);
  });

  it("keeps labels visible when barcode_scanner is false (permission-gated)", () => {
    const items = hrefs("owner", { barcode_scanner: false });
    expect(items).toContain("/labels");
  });

  it("keeps online-orders visible (store-settings, not feature_flags)", () => {
    const items = hrefs("owner", {});
    expect(items).toContain("/online-orders");
  });

  it("shows sales-invoices for owner/manager/cashier (not inventory legacy)", () => {
    expect(hrefs("owner")).toContain("/sales-invoices");
    expect(hrefs("manager")).toContain("/sales-invoices");
    expect(hrefs("cashier")).toContain("/sales-invoices");
    expect(hrefs("inventory")).not.toContain("/sales-invoices");
  });
});

describe("sidebar IA regroup", () => {
  it("keeps POS in Operations and sales documents in their own group", () => {
    expect(groupHrefs("owner", "Operations")).toEqual(
      expect.arrayContaining([
        "/operations",
        "/pos",
        "/orders",
        "/online-orders",
        "/sessions",
      ])
    );
    expect(groupHrefs("owner", "Operations")).not.toContain("/sales-invoices");
    expect(groupHrefs("owner", "Sales Documents")).toEqual([
      "/sales-documents",
      "/quotations",
      "/sales-orders",
      "/sales-invoices",
      "/credit-notes",
    ]);
  });

  it("splits purchasing from inventory and puts products/labels together", () => {
    const inventory = groupHrefs("owner", "Inventory");
    expect(inventory).toEqual(
      expect.arrayContaining([
        "/inventory",
        "/inventory/warehouses",
        "/inventory/movements",
        "/inventory/transfers",
        "/inventory/waste",
        "/inventory/stock-count",
      ])
    );
    expect(inventory).not.toContain("/inventory/purchases");
    expect(inventory).not.toContain("/products");

    expect(groupHrefs("owner", "Purchasing")).toEqual([
      "/purchasing",
      "/inventory/purchase-requests",
      "/inventory/purchase-orders",
      "/inventory/purchases",
      "/inventory/purchase-returns",
      "/inventory/suppliers",
    ]);

    expect(groupHrefs("owner", "Products")).toEqual([
      "/catalog",
      "/products",
      "/labels",
    ]);
    expect(groupHrefs("owner", "Reports")).not.toContain("/labels");
  });

  it("moves promotions under Customers and guide under Administration", () => {
    expect(groupHrefs("owner", "Customers")).toEqual([
      "/customers",
      "/customers/directory",
      "/customers/loyalty",
      "/promotions",
    ]);
    expect(groupHrefs("owner", "Dashboard")).toEqual(["/"]);
    expect(groupHrefs("owner", "Administration")).toEqual(
      expect.arrayContaining(["/admin", "/guide", "/settings"])
    );
    expect(groupHrefs("owner", "Accounting")[0]).toBe("/accounting");
    expect(groupHrefs("owner", "Accounting")).toContain("/accounting/accounts");
  });

  it("hides purchase cycle and stock movements from cashier legacy nav", () => {
    const items = hrefs("cashier");
    expect(items).not.toContain("/inventory/purchase-requests");
    expect(items).not.toContain("/inventory/purchase-orders");
    expect(items).not.toContain("/inventory/purchase-returns");
    expect(items).not.toContain("/inventory/purchases");
    expect(items).not.toContain("/inventory/movements");
    expect(items).not.toContain("/purchasing");
    expect(items).not.toContain("/catalog");
    expect(items).not.toContain("/admin");
    expect(items).toContain("/operations");
    expect(items).toContain("/pos");
    expect(items).toContain("/sales-invoices");
  });
});
