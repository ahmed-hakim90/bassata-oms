import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260619003230_batch_checkout_order_safety.sql"
  ),
  "utf8"
);

describe("checkout safety migration", () => {
  it("adds a transaction-safe order number counter", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.order_number_counters");
    expect(migration).toContain("ON CONFLICT (store_id, business_date)");
    expect(migration).toContain("public.next_order_number(p_store_id, now())");
  });

  it("deducts sale movements from inventory batches", () => {
    expect(migration).toContain("CREATE TRIGGER trg_apply_sale_inventory_batch_deduction");
    expect(migration).toContain("AFTER INSERT ON public.inventory_movements");
    expect(migration).toContain("inventory_batch_movements");
    expect(migration).toContain("remaining_quantity = remaining_quantity - v_take");
  });

  it("restores original batches on order refunds and voids", () => {
    expect(migration).toContain("CREATE TRIGGER trg_apply_order_return_inventory_batch_restore");
    expect(migration).toContain("NEW.reference_type NOT IN ('order_refund', 'order_void')");
    expect(migration).toContain("remaining_quantity = remaining_quantity + v_restore");
    expect(migration).toContain("v_remaining_from_sale := v_sale_batch.sold_quantity - v_already_restored");
  });
});
