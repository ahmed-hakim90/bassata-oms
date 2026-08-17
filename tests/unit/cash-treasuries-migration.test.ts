import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817093000_cash_treasuries.sql",
  "utf8"
);

describe("cash treasuries migration contract", () => {
  it("defines HQ and store treasuries with append-only ledger", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS cash_treasuries");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS cash_treasury_ledger");
    expect(migration).toContain("'hq'");
    expect(migration).toContain("'store'");
    expect(migration).toContain("uq_cash_treasury_period_sweep");
  });

  it("exposes privileged RPCs and revokes helpers from clients", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_transfer");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_period_sweep");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_post_expense");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_post_collection");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION treasury_post_supplier_pay");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION treasury_transfer(UUID, UUID, NUMERIC, TEXT) TO authenticated"
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION ensure_hq_treasury(UUID) FROM PUBLIC, anon, authenticated"
    );
    expect(migration).toContain(
      "p_destination_treasury_id UUID DEFAULT NULL"
    );
  });

  it("links expenses and payments to treasuries", () => {
    expect(migration).toContain("ALTER TABLE expenses");
    expect(migration).toContain("ALTER TABLE customer_payments");
    expect(migration).toContain("ALTER TABLE supplier_payments");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS treasury_id");
  });
});
