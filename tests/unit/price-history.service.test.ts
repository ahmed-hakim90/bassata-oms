import { describe, expect, it } from "vitest";
import { buildSupplierPriceHistory } from "@/modules/purchases/services/price-history.service";
import type { Product, PurchaseInvoiceLine, Supplier } from "@/lib/types";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";

const supplier: Supplier = {
  id: "supplier-1",
  org_id: "org-1",
  name: "Fresh Co",
  contact_info: "",
  opening_balance: 0,
};

const product: Product = {
  id: "product-1",
  org_id: "org-1",
  name: "Mango Bag",
  sku: "MANGO",
  barcode: "MANGO",
  category_id: "cat-1",
  base_price: 0,
  description: "",
  sale_price: null,
  updated_at: new Date().toISOString(),
  image_url: null,
  is_active: true,
  is_popular: false,
  track_inventory: true,
  product_type: "ingredient",
  unit: "bag",
  last_unit_cost: 14,
  cost_unit: "bag",
};

function line(id: string, unitCost: number): PurchaseInvoiceLine {
  return {
    id,
    invoice_id: `invoice-${id}`,
    product_id: product.id,
    variant_id: null,
    quantity: 2,
    unit_cost: unitCost,
    line_total: unitCost * 2,
    landed_unit_cost: null,
    landed_line_total: null,
  };
}

function purchase(id: string, date: string, unitCost: number): PurchaseWithLines {
  return {
    id,
    store_id: "store-1",
    warehouse_id: "warehouse-1",
    supplier_id: supplier.id,
    invoice_number: id.toUpperCase(),
    status: "received",
    subtotal: unitCost * 2,
    extra_cost: 0,
    tax: 0,
    total: unitCost * 2,
    received_at: date,
    cancelled_at: null,
    created_by: "user-1",
    created_at: date,
    lines: [line(id, unitCost)],
    supplierName: supplier.name,
    warehouseName: "Main",
  };
}

describe("buildSupplierPriceHistory", () => {
  it("returns latest unit cost and percent change", () => {
    const result = buildSupplierPriceHistory(
      [
        purchase("old", "2026-01-01T00:00:00.000Z", 10),
        purchase("new", "2026-02-01T00:00:00.000Z", 12),
      ],
      [supplier],
      [product]
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.latestUnitCost).toBe(12);
    expect(result[0]?.previousUnitCost).toBe(10);
    expect(result[0]?.changePercent).toBe(20);
  });

  it("ignores draft purchases", () => {
    const draft = { ...purchase("draft", "2026-03-01T00:00:00.000Z", 99), status: "draft" as const };
    const result = buildSupplierPriceHistory([draft], [supplier], [product]);

    expect(result).toEqual([]);
  });
});
