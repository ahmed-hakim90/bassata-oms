/**
 * Wipe operational/transactional data while keeping users and products.
 *
 * Usage:
 *   CONFIRM_WIPE=yes npm run db:wipe-operational
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (process.env.CONFIRM_WIPE !== "yes") {
  console.error("Refusing to wipe data. Re-run with: CONFIRM_WIPE=yes npm run db:wipe-operational");
  process.exit(1);
}

const TABLES_TO_WIPE = [
  "order_item_deductions",
  "order_payments",
  "order_items",
  "orders",
  "online_order_items",
  "online_orders",
  "inventory_batch_movements",
  "inventory_batches",
  "inventory_movements",
  "stock_levels",
  "stock_count_lines",
  "stock_counts",
  "cashier_sessions",
  "customer_ledger",
  "customer_payments",
  "customers",
  "expenses",
  "purchase_invoice_lines",
  "purchase_invoices",
  "supplier_payments",
  "transfer_order_lines",
  "transfer_orders",
  "waste_records",
  "audit_logs",
  "pin_attempts",
  "device_pairing_codes",
  "device_pairing_attempts",
  "import_jobs",
  "loyalty_ledger",
  "product_serial_numbers",
];

const KEEP_COUNTS = ["users", "products", "categories"];

async function countTable(admin, table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function wipeTable(admin, table) {
  const { error } = await admin.from(table).delete().not("id", "is", null);
  if (error) {
    const fallback = await admin.from(table).delete().gte("created_at", "1970-01-01T00:00:00Z");
    if (fallback.error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Before:");
  for (const table of [...KEEP_COUNTS, "cashier_sessions", "orders", "online_orders", "customers"]) {
    console.log(`  ${table}: ${await countTable(admin, table)}`);
  }

  for (const table of TABLES_TO_WIPE) {
    process.stdout.write(`Wiping ${table}...`);
    await wipeTable(admin, table);
    console.log(" done");
  }

  console.log("\nAfter:");
  for (const table of [...KEEP_COUNTS, "cashier_sessions", "orders", "online_orders", "customers"]) {
    console.log(`  ${table}: ${await countTable(admin, table)}`);
  }
  console.log("\nDone. Users and products were kept.");
}

main().catch((error) => {
  console.error("Wipe failed:", error.message);
  process.exit(1);
});
