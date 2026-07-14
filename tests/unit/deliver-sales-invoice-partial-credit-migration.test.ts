import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260714222000_deliver_sales_invoice_partial_credit.sql"
  ),
  "utf8"
);

describe("deliver sales invoice partial credit migration", () => {
  it("drops legacy overloads and accepts p_payments", () => {
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public.deliver_sales_invoice(UUID, public.payment_method)"
    );
    expect(migration).toContain("p_payments JSONB DEFAULT NULL");
    expect(migration).toContain("Split payments must equal order total");
    expect(migration).toContain("v_payment_status := 'partial'");
  });

  it("posts ledger debit for credit share only", () => {
    expect(migration).toContain("account_balance = account_balance + v_credit_amount");
    expect(migration).toContain("Credit limit against credit portion only");
  });
});
