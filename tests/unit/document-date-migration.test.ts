import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260714213425_document_date_sales_purchases.sql"
  ),
  "utf8"
);

describe("document_date sales/purchases migration", () => {
  it("adds document_date on orders and purchase_invoices", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS document_date DATE");
    expect(migration).toContain("ALTER TABLE public.orders");
    expect(migration).toContain("ALTER TABLE public.purchase_invoices");
    expect(migration).toContain("ALTER COLUMN document_date SET NOT NULL");
    expect(migration).toContain("DISABLE TRIGGER purchases_require_feature");
  });

  it("stamps issue/deliver and stock/AR with document_date", () => {
    expect(migration).toContain("v_at := (COALESCE(v_order.document_date");
    expect(migration).toContain("issued_at = v_at");
    expect(migration).toContain("delivered_at = v_at");
    expect(migration).toContain("created_by, created_at");
    expect(migration).toContain("v_caller, v_at");
    expect(migration).toContain("INSERT INTO customer_ledger");
  });
});
