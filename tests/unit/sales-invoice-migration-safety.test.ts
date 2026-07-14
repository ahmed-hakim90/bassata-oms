import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260714184753_sales_invoice_document_lifecycle.sql"
  ),
  "utf8"
);

describe("sales invoice document lifecycle migration", () => {
  it("adds document status columns and warehouse on orders", () => {
    expect(migration).toContain("CREATE TYPE public.sales_document_status AS ENUM");
    expect(migration).toContain("'draft', 'issued', 'delivered'");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS document_status");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS issued_at");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS delivered_at");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS warehouse_id");
    expect(migration).toContain("idx_orders_store_document_status");
  });

  it("keeps issue sessionless and stock-free (draft → issued only)", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.issue_sales_invoice");
    expect(migration).toContain("Only draft sales invoices can be issued");
    expect(migration).toContain("Sales invoices must be sessionless");
    expect(migration).toContain("Add at least one line before issuing");
    expect(migration).toContain("Invoice total must be greater than zero");
    expect(migration).toContain("SET document_status = 'issued'");
    // issue must not insert inventory movements
    const issueFn = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.issue_sales_invoice"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.deliver_sales_invoice")
    );
    expect(issueFn).not.toContain("INSERT INTO inventory_movements");
    expect(issueFn).not.toContain("INSERT INTO payments");
  });

  it("delivers only issued invoices and mutates stock + optional payment", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.deliver_sales_invoice");
    expect(migration).toContain("Only issued sales invoices can be delivered");
    expect(migration).toContain("Period is closed for this date");
    expect(migration).toContain("INSERT INTO inventory_movements");
    expect(migration).toContain("SET document_status = 'delivered'");
    expect(migration).toContain("Customer required for unpaid delivery");
    expect(migration).toContain("Warehouse is not valid for this store");
  });

  it("enforces wholesale activity + cashier wholesale on both RPCs", () => {
    expect(migration).toContain("enable_wholesale_sales");
    expect(migration).toContain("Wholesale sales are disabled");
    expect(migration).toContain("allow_cashier_wholesale");
    expect(migration).toContain("Cashier wholesale sales are not allowed");
  });

  it("grants execute to authenticated and requires checkout_create or privilege", () => {
    expect(migration).toContain("has_permission('checkout_create')");
    expect(migration).toContain("is_privileged_role()");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.issue_sales_invoice(UUID) TO authenticated"
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.deliver_sales_invoice(UUID, public.payment_method) TO authenticated"
    );
  });
});
