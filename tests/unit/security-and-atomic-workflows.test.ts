import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAllowedKitchenTransition } from "@/modules/kitchen/services/kitchen.service";

const checkoutSecurity = readFileSync(
  "supabase/migrations/20260811090000_secure_checkout_entrypoint.sql",
  "utf8"
);
const onlineAtomic = [
  "supabase/migrations/20260811092000_atomic_online_order_workflows.sql",
  "supabase/migrations/20260811093000_atomic_online_order_status.sql",
].map((path) => readFileSync(path, "utf8")).join("\n");
const rpcHardening = readFileSync(
  "supabase/migrations/20260811094000_rpc_execute_hardening.sql",
  "utf8"
);
const atomicInventory = readFileSync(
  "supabase/migrations/20260811100000_atomic_inventory_adjustments.sql",
  "utf8"
);
const atomicTransfers = readFileSync(
  "supabase/migrations/20260811101000_atomic_transfer_lifecycle.sql",
  "utf8"
);
const atomicPurchaseReceive = readFileSync(
  "supabase/migrations/20260816192751_receive_purchase_invoice.sql",
  "utf8"
);
const managerOverridePin = readFileSync(
  "supabase/migrations/20260817061500_verify_manager_override_pin.sql",
  "utf8"
);

describe("checkout trust boundary", () => {
  it("keeps checkout cores private and validates permission, identity, and discount threshold", () => {
    expect(checkoutSecurity).toContain("RENAME TO complete_checkout_core");
    expect(checkoutSecurity).toContain("RENAME TO complete_checkout_split_core");
    expect(checkoutSecurity).toContain("REVOKE ALL ON FUNCTION public.complete_checkout_core");
    expect(checkoutSecurity).toContain("NOT has_permission('checkout_create')");
    expect(checkoutSecurity).toContain("RAISE EXCEPTION 'Cashier mismatch'");
    expect(checkoutSecurity).toContain("Manager discount override required");
    expect(rpcHardening).toContain("FROM PUBLIC, anon, authenticated");
  });
});

describe("atomic online-order workflows", () => {
  it("creates headers and lines together and makes invoice conversion idempotent", () => {
    expect(onlineAtomic).toContain("create_online_order_atomic");
    expect(onlineAtomic).toContain("online_orders_order_id_unique");
    expect(onlineAtomic).toContain("invoice_online_order_checkout");
    expect(onlineAtomic).toContain("FOR UPDATE");
    expect(onlineAtomic).toContain("idempotent_replay");
  });

  it("changes reservations and status in the same transaction", () => {
    expect(onlineAtomic).toContain("set_online_order_reservation");
    expect(onlineAtomic).toContain("transition_online_order_status_atomic");
    expect(onlineAtomic).toContain("Insufficient stock");
  });
});

describe("atomic inventory workflows", () => {
  it("updates stock, batches, movements, and audit history in one RPC", () => {
    expect(atomicInventory).toContain("adjust_inventory_stock");
    expect(atomicInventory).toContain("pg_advisory_xact_lock");
    expect(atomicInventory).toContain("ON CONFLICT");
    expect(atomicInventory).toContain("inventory_movements");
    expect(atomicInventory).toContain("insert_audit_log");
    expect(atomicInventory).toContain("FROM PUBLIC, anon");
  });

  it("keeps every transfer lifecycle stock movement and status change transactional", () => {
    expect(atomicTransfers).toContain("send_transfer_atomic");
    expect(atomicTransfers).toContain("receive_transfer_atomic");
    expect(atomicTransfers).toContain("void_transfer_atomic");
    expect(atomicTransfers).toContain("FOR UPDATE");
    expect(atomicTransfers).toContain("adjust_inventory_stock");
    expect(atomicTransfers).toContain("FROM PUBLIC, anon");
  });

  it("receives purchase invoices with stock and status in one locked RPC", () => {
    expect(atomicPurchaseReceive).toContain("receive_purchase_invoice");
    expect(atomicPurchaseReceive).toContain("FOR UPDATE");
    expect(atomicPurchaseReceive).toContain("adjust_inventory_stock");
    expect(atomicPurchaseReceive).toContain("Already received");
    expect(atomicPurchaseReceive).toContain("FROM PUBLIC, anon");
  });
});

describe("kitchen state machine", () => {
  it("allows only forward one-step transitions", () => {
    expect(isAllowedKitchenTransition("queued", "preparing")).toBe(true);
    expect(isAllowedKitchenTransition("preparing", "ready")).toBe(true);
    expect(isAllowedKitchenTransition("ready", "served")).toBe(true);
    expect(isAllowedKitchenTransition("queued", "served")).toBe(false);
    expect(isAllowedKitchenTransition("ready", "preparing")).toBe(false);
  });

  it("seeds kitchen mutation permission for future organizations", () => {
    const migration = readFileSync(
      "supabase/migrations/20260811095000_seed_kitchen_permission_for_new_orgs.sql",
      "utf8"
    );
    expect(migration).toContain("AFTER INSERT ON organizations");
    expect(migration).toContain("'cashier', 'kitchen_manage'");
  });
});

describe("manager override PIN", () => {
  it("verifies owner/manager PIN without switching the active cashier", () => {
    expect(managerOverridePin).toContain("verify_manager_override_pin");
    expect(managerOverridePin).toContain("u.role IN ('owner', 'manager')");
    expect(managerOverridePin).toContain("GRANT EXECUTE ON FUNCTION public.verify_manager_override_pin");
    expect(managerOverridePin).toContain("FROM PUBLIC, anon");
  });
});
