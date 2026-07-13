/**
 * P0 security verification against linked Supabase (apply migration 025).
 * Requires: .env.local, db reset/seed, npm run db:seed-auth
 */
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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
const inventoryEmail = process.env.VERIFY_INVENTORY_EMAIL ?? "inventory@CafeFlow.local";
const inventoryPassword = process.env.VERIFY_INVENTORY_PASSWORD ?? "demo1234";
const storeId = "00000000-0000-4000-8000-000000000101";
const inventoryUserId = "00000000-0000-4000-8000-000000000205";

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

function client() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fail(label, error) {
  console.error(`✗ ${label}:`, error?.message ?? error);
  process.exit(1);
}

async function signIn(email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) fail(`signIn ${email}`, error ?? new Error("no session"));
  return supabase;
}

console.log("→ Owner: pin_codes direct access denied");
{
  const supabase = await signIn(ownerEmail, ownerPassword);
  const { data, error } = await supabase.from("pin_codes").select("id").limit(1);
  if (error) {
    console.log("✓ pin_codes blocked for authenticated (RLS error)");
  } else if (!data?.length) {
    console.log("✓ pin_codes blocked for authenticated (no rows visible)");
  } else {
    fail("pin_codes SELECT", new Error("expected RLS denial or empty result"));
  }
  await supabase.auth.signOut();
}

console.log("→ Inventory: cannot insert orders");
{
  const supabase = await signIn(inventoryEmail, inventoryPassword);
  const { error } = await supabase.from("orders").insert({
    store_id: storeId,
    order_number: "TEST-P0",
    status: "completed",
    subtotal: 1,
    discount: 0,
    tax: 0,
    total: 1,
    payment_status: "paid",
    created_by: inventoryUserId,
  });
  if (!error) fail("inventory order insert", new Error("expected RLS denial"));
  console.log("✓ inventory cannot insert orders");
  await supabase.auth.signOut();
}

console.log("→ Pairing RPC not granted to anon");
{
  const supabase = client();
  const { error } = await supabase.rpc("consume_device_pairing_code", { p_code: "BADCODE1" });
  if (!error || !/permission|42501|42883/i.test(error.message)) {
    fail("anon pairing", error ?? new Error("expected permission error"));
  }
  console.log("✓ anon cannot consume pairing codes");
}

console.log("\nP0 security verification passed.");
