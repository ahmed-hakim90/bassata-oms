import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260713142010_refund_restock_and_partial_credit_fix.sql"
  ),
  "utf8"
);

describe("S09 refund restock + partial credit migration", () => {
  it("adds refund/void RPCs that reverse sale movements only", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.refund_order");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.void_order");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.reverse_order_stock_and_credit");
    expect(migration).toContain("reference_type = 'order'");
    expect(migration).toContain("movement_type = 'sale'");
    expect(migration).toContain("quantity_delta < 0");
    expect(migration).toContain("reference_type IN ('order_refund', 'order_void')");
  });

  it("reverses credit AR from payment lines not order total", () => {
    expect(migration).toContain("WHERE order_id = p_order_id AND method = 'credit'");
    expect(migration).toContain("entry_type, debit, credit");
    expect(migration).toContain("'refund'");
    expect(migration).toContain("account_balance = account_balance - v_credit_amount");
  });

  it("persists partial payment_status on credit split checkout", () => {
    expect(migration).toContain("v_payment_status := 'partial'");
    expect(migration).toContain("SET payment_status = v_payment_status");
    expect(migration).toContain("'credit_amount', v_credit_amount");
    expect(migration).toContain("abs(round(v_payment_total, 2) - v_total) > 0.05");
  });
});
