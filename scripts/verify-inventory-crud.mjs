/**
 * Verifies draft delete and void flows for transfers/purchases (requires 009 on DB).
 */
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { getDefaultWarehouseId } from "./verify-db-helpers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ownerEmail = process.env.VERIFY_OWNER_EMAIL ?? "owner@CafeFlow.local";
const ownerPassword = process.env.VERIFY_OWNER_PASSWORD ?? "demo1234";
const ownerUserId = "00000000-0000-4000-8000-000000000201";
const storeFrom = "00000000-0000-4000-8000-000000000102";
const storeTo = "00000000-0000-4000-8000-000000000101";
const storePurchase = "00000000-0000-4000-8000-000000000101";
const supplierId = "00000000-0000-4000-8000-000000000501";

if (!url || !anonKey) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(label, error) {
  console.error(`✗ ${label}:`, error?.message ?? error);
  process.exit(1);
}

const { error: authError } = await supabase.auth.signInWithPassword({
  email: ownerEmail,
  password: ownerPassword,
});
if (authError) fail("signIn", authError);
console.log("✓ Signed in as", ownerEmail);

let fromWarehouseId;
let toWarehouseId;
let purchaseWarehouseId;
try {
  fromWarehouseId = await getDefaultWarehouseId(supabase, storeFrom);
  toWarehouseId = await getDefaultWarehouseId(supabase, storeTo);
  purchaseWarehouseId = await getDefaultWarehouseId(supabase, storePurchase);
} catch (e) {
  fail("resolve default warehouses (013 multi-warehouse)", e);
}

const { data: draftTransfer, error: tInsertErr } = await supabase
  .from("transfer_orders")
  .insert({
    from_store_id: storeFrom,
    to_store_id: storeTo,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    status: "draft",
    created_by: ownerUserId,
  })
  .select()
  .single();
if (tInsertErr || !draftTransfer) fail("create draft transfer", tInsertErr);

const { error: tDelErr } = await supabase
  .from("transfer_orders")
  .delete()
  .eq("id", draftTransfer.id);
if (tDelErr) fail("delete draft transfer", tDelErr);
console.log("✓ Draft transfer delete");

const { data: sentTransfer, error: sentErr } = await supabase
  .from("transfer_orders")
  .insert({
    from_store_id: storeFrom,
    to_store_id: storeTo,
    from_warehouse_id: fromWarehouseId,
    to_warehouse_id: toWarehouseId,
    status: "sent",
    sent_at: new Date().toISOString(),
    created_by: ownerUserId,
  })
  .select()
  .single();
if (sentErr || !sentTransfer) fail("create sent transfer", sentErr);

const { error: cancelErr } = await supabase
  .from("transfer_orders")
  .update({ status: "cancelled" })
  .eq("id", sentTransfer.id);
if (cancelErr) fail("cancel transfer status", cancelErr);
console.log("✓ Transfer cancelled status update");

await supabase.from("transfer_orders").delete().eq("id", sentTransfer.id);

const { data: draftPurchase, error: pInsertErr } = await supabase
  .from("purchase_invoices")
  .insert({
    store_id: storePurchase,
    warehouse_id: purchaseWarehouseId,
    supplier_id: supplierId,
    invoice_number: `TEST-${Date.now()}`,
    status: "draft",
    subtotal: 0,
    tax: 0,
    total: 0,
    created_by: ownerUserId,
  })
  .select()
  .single();
if (pInsertErr || !draftPurchase) fail("create draft purchase", pInsertErr);

const { error: pDelErr } = await supabase
  .from("purchase_invoices")
  .delete()
  .eq("id", draftPurchase.id);
if (pDelErr) fail("delete draft purchase", pDelErr);
console.log("✓ Draft purchase delete");

console.log("\nInventory CRUD verification passed (apply 009 for cancelled enum in app).");
