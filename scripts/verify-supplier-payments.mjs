/**
 * Verifies migration 016 (supplier_payments + cancelled_at) on linked/remote Supabase.
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
const orgId = "00000000-0000-4000-8000-000000000001";
const ownerEmail = process.env.VERIFY_OWNER_EMAIL ?? "owner@CafeFlow.local";
const ownerPassword = process.env.VERIFY_OWNER_PASSWORD ?? "demo1234";
const ownerUserId = "00000000-0000-4000-8000-000000000201";
const storeId = "00000000-0000-4000-8000-000000000101";
const supplierId = "00000000-0000-4000-8000-000000000501";

if (!url || !anonKey) {
  console.error("Missing Supabase env in .env.local");
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

const { error: schemaProbe } = await supabase.from("supplier_payments").select("id").limit(1);
if (schemaProbe?.message?.includes("does not exist") || schemaProbe?.code === "42P01") {
  fail(
    "supplier_payments table",
    new Error("Apply migration 016: npm run db:apply-016")
  );
}
if (schemaProbe && schemaProbe.code !== "PGRST116" && schemaProbe.message && !schemaProbe.message.includes("0 rows")) {
  // PGRST116 = empty ok; other errors may still be RLS empty result
  if (!schemaProbe.message.includes("permission") && schemaProbe.code) {
    console.warn("⚠ supplier_payments probe:", schemaProbe.message);
  }
}
console.log("✓ supplier_payments table reachable");

const { data: payment, error: payErr } = await supabase
  .from("supplier_payments")
  .insert({
    org_id: orgId,
    store_id: storeId,
    supplier_id: supplierId,
    amount: 1.5,
    payment_method: "cash",
    reference: `VERIFY-${Date.now()}`,
    notes: "verify script",
    paid_at: new Date().toISOString(),
    created_by: ownerUserId,
  })
  .select()
  .single();
if (payErr || !payment) fail("insert supplier_payment", payErr);
console.log("✓ Supplier payment insert");

const { data: voided, error: voidErr } = await supabase
  .from("supplier_payments")
  .update({ voided_at: new Date().toISOString() })
  .eq("id", payment.id)
  .is("voided_at", null)
  .select()
  .single();
if (voidErr || !voided) fail("void supplier_payment", voidErr);
console.log("✓ Supplier payment void");

const { data: invoices, error: invErr } = await supabase
  .from("purchase_invoices")
  .select("id, cancelled_at, status")
  .eq("store_id", storeId)
  .eq("supplier_id", supplierId)
  .limit(1);
if (invErr) fail("purchase_invoices select", invErr);
if (invoices?.length) {
  const hasCancelledAt = "cancelled_at" in invoices[0];
  if (!hasCancelledAt) fail("cancelled_at column", new Error("missing on purchase_invoices"));
  console.log("✓ purchase_invoices.cancelled_at present");
}

console.log("\nSupplier payments verification passed.");
