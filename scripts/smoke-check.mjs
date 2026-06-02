#!/usr/bin/env node
/**
 * Automated release-gate checks (no browser).
 */
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

loadEnv();

console.log("→ npm run lint");
run("npm", ["run", "lint"]);

console.log("→ npx tsc --noEmit");
run("npx", ["tsc", "--noEmit"]);

console.log("→ npm run test");
run("npm", ["run", "test"]);

console.log("→ npm run build");
run("npm", ["run", "build"]);

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn("⚠ Missing env (browser smoke will fail):", missing.join(", "));
} else {
  console.log("✓ Supabase env present");
}

const requireCookieSecret =
  process.env.NODE_ENV === "production" || process.env.CI === "true";

if (!process.env.SweetFlow_COOKIE_SECRET) {
  if (requireCookieSecret) {
    console.error("✗ SweetFlow_COOKIE_SECRET required in production/CI");
    process.exit(1);
  }
  console.warn("⚠ SweetFlow_COOKIE_SECRET not set — dev fallback only");
} else {
  console.log("✓ SweetFlow_COOKIE_SECRET set");
}

const migrations = [
  "001_initial_schema.sql",
  "002_rls_production.sql",
  "003_production_hardening.sql",
  "004_app_settings_rls.sql",
  "005_feature_flags_and_rls_roles.sql",
  "006_fix_flags_and_org_rls.sql",
  "007_apply_003_remaining.sql",
  "008_recipes_and_costing.sql",
  "009_inventory_cancelled_status.sql",
  "011_accounting_centers_expenses.sql",
  "012_online_menu_orders.sql",
  "013_multi_warehouse_per_branch.sql",
  "014_recipe_demo_seed.sql",
  "015_full_rbac_permissions.sql",
  "016_supplier_payments.sql",
  "017_product_variants_recipes.sql",
  "018_session_management.sql",
  "019_device_delete_set_null.sql",
  "020_online_menu_slug.sql",
  "021_pos_device_access.sql",
  "022_tenant_foundation.sql",
  "023_customer_accounts.sql",
  "025_p0_production_hardening.sql",
  "026_checkout_wallet_credit.sql",
  "027_split_payments.sql",
  "028_expired_session_checkout_override.sql",
  "029_purchase_landed_cost.sql",
  "030_souqna_integration.sql",
  "031_souqna_provider_completion.sql",
  "032_fix_pairing_anon_grants.sql",
];
for (const m of migrations) {
  const p = resolve(root, "supabase/migrations", m);
  if (!existsSync(p)) {
    console.error("✗ Missing migration:", m);
    process.exit(1);
  }
}
console.log("✓ All migration files present");

console.log("\nAutomated smoke check passed. Run manual steps in docs/SMOKE_TEST.md");
