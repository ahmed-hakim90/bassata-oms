import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isActiveStockCountStatus,
  ACTIVE_STOCK_COUNT_STATUSES,
} from "@/modules/stock-count/services/count.service";
import { netReservedByLine } from "@/modules/online-orders/services/online-order-reservation.service";
import { levelsToAlerts } from "@/modules/inventory/services/alert.service";
import { summarizeExpiryBatches } from "@/modules/inventory/services/expiry.service";
import { buildReorderSuggestions } from "@/modules/inventory/services/reorder.service";
import type { InventoryBatch, Product, StockLevel } from "@/lib/types";

describe("S12 stock count approval", () => {
  it("extends stock_count_status with pending_approval and approved", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260713210000_stock_count_approval_statuses.sql"),
      "utf8"
    );
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'pending_approval'");
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'approved'");
  });

  it("treats pending_approval and approved as active (block new count)", () => {
    expect(ACTIVE_STOCK_COUNT_STATUSES).toEqual([
      "in_progress",
      "pending_approval",
      "approved",
    ]);
    expect(isActiveStockCountStatus("in_progress")).toBe(true);
    expect(isActiveStockCountStatus("pending_approval")).toBe(true);
    expect(isActiveStockCountStatus("approved")).toBe(true);
    expect(isActiveStockCountStatus("completed")).toBe(false);
  });
});

describe("S12 online order reservation net", () => {
  it("computes held qty from reservation and release movements", () => {
    const held = netReservedByLine([
      {
        movement_type: "reservation",
        product_id: "p1",
        variant_id: null,
        quantity_delta: -3,
      },
      {
        movement_type: "reservation_release",
        product_id: "p1",
        variant_id: null,
        quantity_delta: 1,
      },
      {
        movement_type: "sale",
        product_id: "p1",
        variant_id: null,
        quantity_delta: -9,
      },
    ]);
    expect(held.get("p1:")).toBe(2);
  });

  it("returns zero after full release", () => {
    const held = netReservedByLine([
      {
        movement_type: "reservation",
        product_id: "p1",
        variant_id: "v1",
        quantity_delta: -2,
      },
      {
        movement_type: "reservation_release",
        product_id: "p1",
        variant_id: "v1",
        quantity_delta: 2,
      },
    ]);
    expect(held.get("p1:v1")).toBe(0);
  });
});

describe("S12 reorder/expiry alert smoke", () => {
  const product = {
    id: "prod-1",
    name: "Latte",
    track_inventory: true,
    base_unit: "pcs",
    unit: "pcs",
    last_unit_cost: 5,
  } as unknown as Product;

  it("levelsToAlerts ranks out-of-stock as danger", () => {
    const alerts = levelsToAlerts([
      {
        id: "lvl-1",
        store_id: "s1",
        warehouse_id: "w1",
        product_id: "prod-1",
        variant_id: null,
        quantity: 0,
        reorder_point: 5,
        updated_at: new Date().toISOString(),
        product,
      },
      {
        id: "lvl-2",
        store_id: "s1",
        warehouse_id: "w1",
        product_id: "prod-1",
        variant_id: null,
        quantity: 2,
        reorder_point: 5,
        updated_at: new Date().toISOString(),
        product: { ...product, id: "prod-2", name: "Tea" },
      },
    ]);
    expect(alerts.length).toBe(2);
    expect(alerts[0].type).toBe("out_of_stock");
    expect(alerts[0].severity).toBe("danger");
    expect(alerts[1].type).toBe("reorder_soon");
  });

  it("summarizeExpiryBatches flags near/expired batches", () => {
    const today = new Date(2026, 6, 13);
    const batches = [
      {
        id: "b1",
        product_id: "prod-1",
        batch_number: "A1",
        expiry_date: "2026-07-10",
        remaining_quantity: 4,
        unit: "pcs",
      },
      {
        id: "b2",
        product_id: "prod-1",
        batch_number: "A2",
        expiry_date: "2026-07-20",
        remaining_quantity: 2,
        unit: "pcs",
      },
      {
        id: "b3",
        product_id: "prod-1",
        batch_number: "A3",
        expiry_date: "2026-12-01",
        remaining_quantity: 8,
        unit: "pcs",
      },
    ] as unknown as InventoryBatch[];

    const alerts = summarizeExpiryBatches(batches, [product], {
      today,
      warningDays: 14,
    });
    expect(alerts.map((a) => a.batchNumber)).toEqual(["A1", "A2"]);
    expect(alerts[0].severity).toBe("danger");
    expect(alerts[1].severity).toBe("warning");
  });

  it("buildReorderSuggestions returns urgent when far below reorder point", () => {
    const level = {
      id: "lvl-1",
      store_id: "s1",
      warehouse_id: "w1",
      product_id: "prod-1",
      variant_id: null,
      quantity: 1,
      reorder_point: 10,
      updated_at: new Date().toISOString(),
      product,
    };
    const suggestions = buildReorderSuggestions(
      [level],
      [{ id: "w1", name: "Main", store_id: "s1", is_default: true, is_active: true } as never],
      new Map()
    );
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].priority).toBe("urgent");
    expect(suggestions[0].suggestedQuantity).toBeGreaterThan(0);
  });
});
