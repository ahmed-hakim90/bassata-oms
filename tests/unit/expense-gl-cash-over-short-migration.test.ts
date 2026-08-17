import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817104500_expense_gl_cash_over_short_org_openings.sql",
  "utf8"
);

describe("expense GL mapping and cash over/short migration", () => {
  it("adds a same-org expense account on categories", () => {
    expect(migration).toContain("ALTER TABLE expense_categories");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS gl_account_id");
    expect(migration).toContain("enforce_expense_category_gl_account_org");
    expect(migration).toContain("account_type = 'expense'");
  });

  it("seeds cash_over_short and keeps the RPC tenant-scoped", () => {
    expect(migration).toContain("cash_over_short");
    expect(migration).toContain("عجز وزيادة الصندوق");
    expect(migration).toContain("ensure_system_gl_accounts");
    expect(migration).toContain(
      "auth.role() = 'authenticated' AND p_org_id IS DISTINCT FROM auth_org_id()"
    );
  });

  it("moves CoA opening journals to org scope", () => {
    expect(migration).toContain("source_id = 'coa_opening'");
    expect(migration).toContain("SET store_id = NULL");
  });
});
