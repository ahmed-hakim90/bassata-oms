import { describe, expect, it } from "vitest";
import { permissionAllowsPath } from "@/lib/repositories/permission.repository";
import type { PermissionKey } from "@/lib/constants";

describe("permissionAllowsPath", () => {
  it("requires purchase_manage for exact purchases path", () => {
    const perms = new Set<PermissionKey>(["purchase_manage"]);
    expect(permissionAllowsPath("/inventory/purchases", perms)).toBe(true);
    expect(permissionAllowsPath("/inventory/purchases", new Set())).toBe(false);
  });

  it("requires checkout_create for sales invoices", () => {
    expect(
      permissionAllowsPath("/sales-invoices", new Set(["checkout_create"]))
    ).toBe(true);
    expect(permissionAllowsPath("/sales-invoices", new Set(["order_view"]))).toBe(
      false
    );
  });

  it("uses longest path prefix for nested purchase routes (price list)", () => {
    const inventoryOnly = new Set<PermissionKey>(["inventory_view"]);
    const purchaseOnly = new Set<PermissionKey>(["purchase_manage"]);

    expect(
      permissionAllowsPath("/inventory/purchases/price-list", inventoryOnly)
    ).toBe(false);
    expect(
      permissionAllowsPath("/inventory/purchases/price-list", purchaseOnly)
    ).toBe(true);
  });
});
