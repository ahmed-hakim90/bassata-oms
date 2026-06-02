import { describe, expect, it } from "vitest";
import { summarizeExpiryBatches } from "@/modules/inventory/services/expiry.service";
import type { InventoryBatch, Product } from "@/lib/types";

const product = {
  id: "product-1",
  name: "Milk",
} as Product;

function batch(
  id: string,
  expiryDate: string | null,
  remainingQuantity = 5
): InventoryBatch {
  return {
    id,
    org_id: "org-1",
    store_id: "store-1",
    warehouse_id: "warehouse-1",
    product_id: "product-1",
    variant_id: null,
    batch_number: `B-${id}`,
    source_type: "purchase",
    source_document_id: null,
    supplier_id: null,
    purchase_invoice_id: null,
    received_date: "2026-05-01",
    production_date: null,
    expiry_date: expiryDate,
    quantity: 10,
    remaining_quantity: remainingQuantity,
    unit: "piece",
    is_expired: false,
    notes: null,
    created_by: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  };
}

describe("summarizeExpiryBatches", () => {
  it("returns expired and near-expiry batches ordered by severity then date", () => {
    const alerts = summarizeExpiryBatches(
      [
        batch("far", "2026-07-01"),
        batch("near", "2026-06-10"),
        batch("expired", "2026-05-30"),
      ],
      [product],
      { today: new Date("2026-06-02T00:00:00.000Z"), warningDays: 14 }
    );

    expect(alerts.map((alert) => alert.id)).toEqual(["expired", "near"]);
    expect(alerts[0]).toMatchObject({
      productName: "Milk",
      daysUntilExpiry: -3,
      severity: "danger",
    });
    expect(alerts[1]).toMatchObject({
      daysUntilExpiry: 8,
      severity: "warning",
    });
  });

  it("ignores batches without stock or expiry dates", () => {
    const alerts = summarizeExpiryBatches(
      [batch("empty", "2026-06-05", 0), batch("no-expiry", null, 5)],
      [product],
      { today: new Date("2026-06-02T00:00:00.000Z"), warningDays: 14 }
    );

    expect(alerts).toEqual([]);
  });
});
