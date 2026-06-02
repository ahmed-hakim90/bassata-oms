#!/usr/bin/env node
/**
 * Push .env.local secrets to Vercel production environment.
 * Usage: node scripts/vercel-env-push.mjs
 */
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const PRODUCTION_APP_URL = process.env.VERCEL_PRODUCTION_URL ?? "https://bassata-oms.vercel.app";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SweetFlow_COOKIE_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

if (!existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const values = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  values[k] = v;
}

values.NEXT_PUBLIC_APP_URL = PRODUCTION_APP_URL;

for (const key of KEYS) {
  const value = values[key];
  if (!value) {
    console.warn(`⚠ Skipping ${key} (not in .env.local)`);
    continue;
  }
  const args = [
    "vercel",
    "env",
    "add",
    key,
    "production",
    "--value",
    value,
    "--yes",
    "--force",
  ];
  if (key === "SUPABASE_SERVICE_ROLE_KEY" || key === "SweetFlow_COOKIE_SECRET") {
    args.push("--sensitive");
  }
  const r = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) {
    console.error(`✗ Failed to set ${key} (production)`);
    process.exit(r.status ?? 1);
  }
  console.log(`✓ ${key} → production`);
}

console.log("\nRedeploy to apply: npx vercel deploy --prod");
