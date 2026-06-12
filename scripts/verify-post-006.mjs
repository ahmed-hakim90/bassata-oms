/**
 * Verifies migration 006 fixes against remote Supabase as owner (RLS + feature flags).
 * Requires: .env.local with Supabase URL/keys; owner@CafeFlow.local linked via db:seed-auth.
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
const orgId = "00000000-0000-4000-8000-000000000001";
const ownerUserId = "00000000-0000-4000-8000-000000000201";
const storeFrom = "00000000-0000-4000-8000-000000000102";
const storeTo = "00000000-0000-4000-8000-000000000101";

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(label, error) {
  console.error(`✗ ${label}:`, error?.message ?? error);
  process.exit(1);
}

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: ownerEmail,
  password: ownerPassword,
});
if (authError || !authData.session) {
  fail("signIn", authError ?? new Error("no session"));
}
console.log("✓ Signed in as", ownerEmail);

const { data: orgBefore } = await supabase
  .from("organizations")
  .select("name")
  .eq("id", orgId)
  .single();

const testName = orgBefore?.name === "SweetFlow Demo" ? "SweetFlow Demo" : "SweetFlow Demo";

const { data: orgUpdated, error: orgError } = await supabase
  .from("organizations")
  .update({ name: testName })
  .eq("id", orgId)
  .select()
  .single();

if (orgError || !orgUpdated) {
  fail("organization UPDATE (006 org_update_privileged)", orgError);
}
console.log("✓ Organization settings update returns row (POST /settings path)");

let fromWarehouseId;
let toWarehouseId;
try {
  fromWarehouseId = await getDefaultWarehouseId(supabase, storeFrom);
  toWarehouseId = await getDefaultWarehouseId(supabase, storeTo);
} catch (e) {
  fail("resolve default warehouses (013 multi-warehouse)", e);
}

const { data: transfer, error: transferError } = await supabase
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

if (transferError || !transfer) {
  fail("transfer_orders INSERT (006 feature_flags + trigger)", transferError);
}
console.log("✓ Transfer create succeeds (POST /inventory/transfers path)");

const { error: deleteError } = await supabase
  .from("transfer_orders")
  .delete()
  .eq("id", transfer.id);
if (deleteError) {
  console.warn("⚠ Could not clean up test transfer:", deleteError.message);
} else {
  console.log("✓ Cleaned up test transfer");
}

console.log("\nPost-006 verification passed.");
