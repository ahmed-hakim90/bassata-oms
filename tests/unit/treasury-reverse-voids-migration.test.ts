import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817120000_treasury_reverse_voids.sql",
  "utf8"
);

describe("treasury reverse voids migration contract", () => {
  it("defines idempotent reverse RPCs and keeps apply_delta client-revoked", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_reverse_supplier_pay");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_reverse_expense");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_reverse_collection");
    expect(migration).toContain("IF v_net = 0 THEN");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION treasury_reverse_supplier_pay(UUID) TO authenticated");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION treasury_apply_delta");
  });

  it("requires a privileged role before posting an opposite cash delta", () => {
    expect(migration).toContain("IF NOT is_privileged_role() THEN");
    expect(migration).toContain("عكس سداد مورد ملغي");
    expect(migration).toContain("عكس مصروف محذوف");
    expect(migration).toContain("عكس تحصيل عميل ملغي");
  });
});
