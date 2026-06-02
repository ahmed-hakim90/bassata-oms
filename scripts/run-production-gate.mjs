#!/usr/bin/env node
/**
 * Production release gate: automated checks against linked Supabase (.env.local).
 */
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(label, cmd, args) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("smoke:check", "npm", ["run", "smoke:check"]);
run("verify:post-006", "node", ["scripts/verify-post-006.mjs"]);
run("verify:p0-security", "node", ["scripts/verify-p0-security.mjs"]);
run("verify:inventory-crud", "node", ["scripts/verify-inventory-crud.mjs"]);
run("verify:supplier-payments", "node", ["scripts/verify-supplier-payments.mjs"]);

console.log("\n✓ Production gate passed (automated). Complete manual steps in docs/SMOKE_TEST.md");
