import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817133000_void_customer_payment.sql",
  "utf8"
);

describe("void customer payment migration contract", () => {
  it("voids AR and reverses treasury in one privileged RPC", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION void_customer_payment");
    expect(migration).toContain("IF NOT is_privileged_role()");
    expect(migration).toContain("entry_type, debit, credit");
    expect(migration).toContain("'adjustment'");
    expect(migration).toContain("account_balance = account_balance + v_payment.amount");
    expect(migration).toContain("PERFORM treasury_reverse_collection(v_payment.id)");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION void_customer_payment(UUID) TO authenticated");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION treasury_apply_delta");
  });
});
