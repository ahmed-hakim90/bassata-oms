import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260713190010_sale_batch_fefo_fifo_consumption.sql"
);
const migration = readFileSync(migrationPath, "utf8");

describe("S11 sale batch FEFO/FIFO consumption", () => {
  it("installs AFTER INSERT trigger on inventory_movements", () => {
    expect(migration).toContain("CREATE TRIGGER trg_apply_sale_inventory_batch_deduction");
    expect(migration).toContain("AFTER INSERT ON public.inventory_movements");
    expect(migration).toContain(
      "EXECUTE FUNCTION public.apply_sale_inventory_batch_deduction()"
    );
  });

  it("only auto-picks when movement is a sale without an explicit batch_id", () => {
    expect(migration).toContain("NEW.movement_type <> 'sale'");
    expect(migration).toContain("NEW.batch_id IS NOT NULL");
    expect(migration).toContain(
      "v_product.inventory_tracking_mode NOT IN ('batch', 'batch_and_expiry')"
    );
  });

  it("orders FEFO by expiry then FIFO by received_date", () => {
    expect(migration).toContain("WHEN v_product.inventory_rotation_method = 'FEFO'");
    expect(migration).toContain("THEN b.expiry_date");
    expect(migration).toContain("END ASC NULLS LAST");
    expect(migration).toContain("b.received_date ASC");
    expect(migration).toContain("b.created_at ASC");
    expect(migration).toContain("b.id ASC");
  });

  it("writes inventory_batch_movements and depletes remaining_quantity", () => {
    expect(migration).toContain("INSERT INTO public.inventory_batch_movements");
    expect(migration).toContain("remaining_quantity = remaining_quantity - v_take");
    expect(migration).toContain("FOR UPDATE");
  });

  it("restores original sale batches on refund/void adjustments", () => {
    expect(migration).toContain(
      "CREATE TRIGGER trg_apply_order_return_inventory_batch_restore"
    );
    expect(migration).toContain(
      "NEW.reference_type NOT IN ('order_refund', 'order_void')"
    );
    expect(migration).toContain("remaining_quantity = remaining_quantity + v_restore");
  });
});
