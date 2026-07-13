/**
 * S11 — verifies FEFO/FIFO sale batch consumption via inventory_movements trigger.
 * Uses service role (no CafeFlow demo login required).
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(msg, err) {
  console.error(`✗ ${msg}:`, err?.message ?? err ?? "");
  process.exit(1);
}

const orgId = "00000000-0000-4000-8000-000000000001";
const storeId = "00000000-0000-4000-8000-000000000101";
const warehouseId = "00000000-0000-4000-8000-000000000111";
const userId = "00000000-0000-4000-8000-000000000201";
const fefoId = "aaaaaaaa-1111-4111-8111-111111111101";
const fifoId = "aaaaaaaa-1111-4111-8111-111111111102";
const fefoEarly = "aaaaaaaa-2222-4222-8222-222222222201";
const fefoLate = "aaaaaaaa-2222-4222-8222-222222222202";
const fifoOld = "aaaaaaaa-3333-4333-8333-333333333301";
const fifoNew = "aaaaaaaa-3333-4333-8333-333333333302";
const orderFefo = "aaaaaaaa-4444-4444-8444-444444444401";
const orderFifo = "aaaaaaaa-4444-4444-8444-444444444402";

async function cleanup() {
  await admin.from("inventory_batch_movements").delete().in("batch_id", [
    fefoEarly,
    fefoLate,
    fifoOld,
    fifoNew,
  ]);
  await admin.from("inventory_movements").delete().in("product_id", [fefoId, fifoId]);
  await admin.from("inventory_batches").delete().in("id", [
    fefoEarly,
    fefoLate,
    fifoOld,
    fifoNew,
  ]);
  await admin.from("products").delete().in("id", [fefoId, fifoId]);
}

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
};
const daysAhead = (n) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const { data: category, error: catErr } = await admin
  .from("categories")
  .select("id")
  .eq("org_id", orgId)
  .limit(1)
  .maybeSingle();
if (catErr || !category) fail("resolve category", catErr ?? "missing");

await cleanup();

const { error: prodErr } = await admin.from("products").insert([
  {
    id: fefoId,
    org_id: orgId,
    category_id: category.id,
    name: "S11 FEFO Probe",
    sku: "S11-FEFO",
    base_price: 10,
    track_inventory: true,
    product_type: "finished",
    unit: "piece",
    inventory_tracking_mode: "batch_and_expiry",
    inventory_rotation_method: "FEFO",
    expiry_policy: "warn_only",
  },
  {
    id: fifoId,
    org_id: orgId,
    category_id: category.id,
    name: "S11 FIFO Probe",
    sku: "S11-FIFO",
    base_price: 10,
    track_inventory: true,
    product_type: "finished",
    unit: "piece",
    inventory_tracking_mode: "batch",
    inventory_rotation_method: "FIFO",
    expiry_policy: "warn_only",
  },
]);
if (prodErr) fail("insert products", prodErr);

const { error: batchErr } = await admin.from("inventory_batches").insert([
  {
    id: fefoLate,
    org_id: orgId,
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fefoId,
    batch_number: "FEFO-LATE",
    source_type: "opening_stock",
    received_date: daysAgo(10),
    expiry_date: daysAhead(30),
    quantity: 10,
    remaining_quantity: 10,
    unit: "piece",
    created_by: userId,
  },
  {
    id: fefoEarly,
    org_id: orgId,
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fefoId,
    batch_number: "FEFO-EARLY",
    source_type: "opening_stock",
    received_date: daysAgo(1),
    expiry_date: daysAhead(5),
    quantity: 10,
    remaining_quantity: 10,
    unit: "piece",
    created_by: userId,
  },
  {
    id: fifoNew,
    org_id: orgId,
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fifoId,
    batch_number: "FIFO-NEW",
    source_type: "opening_stock",
    received_date: daysAgo(1),
    expiry_date: daysAhead(5),
    quantity: 10,
    remaining_quantity: 10,
    unit: "piece",
    created_by: userId,
  },
  {
    id: fifoOld,
    org_id: orgId,
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fifoId,
    batch_number: "FIFO-OLD",
    source_type: "opening_stock",
    received_date: daysAgo(20),
    expiry_date: daysAhead(40),
    quantity: 10,
    remaining_quantity: 10,
    unit: "piece",
    created_by: userId,
  },
]);
if (batchErr) {
  await cleanup();
  fail("insert batches", batchErr);
}

const { error: moveErr } = await admin.from("inventory_movements").insert([
  {
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fefoId,
    movement_type: "sale",
    quantity_delta: -3,
    reference_type: "order",
    reference_id: orderFefo,
    created_by: userId,
  },
  {
    store_id: storeId,
    warehouse_id: warehouseId,
    product_id: fifoId,
    movement_type: "sale",
    quantity_delta: -3,
    reference_type: "order",
    reference_id: orderFifo,
    created_by: userId,
  },
]);
if (moveErr) {
  await cleanup();
  fail("insert sale movements (trigger)", moveErr);
}

const { data: rem, error: remErr } = await admin
  .from("inventory_batches")
  .select("id, remaining_quantity")
  .in("id", [fefoEarly, fefoLate, fifoOld, fifoNew]);
if (remErr || !rem) {
  await cleanup();
  fail("read remaining", remErr);
}

const byId = Object.fromEntries(rem.map((r) => [r.id, Number(r.remaining_quantity)]));

try {
  if (byId[fefoEarly] !== 7) {
    throw new Error(`FEFO early remaining=${byId[fefoEarly]} expected 7`);
  }
  if (byId[fefoLate] !== 10) {
    throw new Error(`FEFO late remaining=${byId[fefoLate]} expected 10`);
  }
  if (byId[fifoOld] !== 7) {
    throw new Error(`FIFO old remaining=${byId[fifoOld]} expected 7`);
  }
  if (byId[fifoNew] !== 10) {
    throw new Error(`FIFO new remaining=${byId[fifoNew]} expected 10`);
  }
} catch (e) {
  await cleanup();
  fail("rotation assertions", e);
}

await cleanup();
console.log("✓ FEFO sale consumed earliest expiry batch");
console.log("✓ FIFO sale consumed earliest received batch");
console.log("✓ verify-batch-rotation passed");
