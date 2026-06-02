#!/usr/bin/env node
/**
 * Static migration audit:
 * - lists public tables without explicit RLS enablement
 * - lists public tables without at least one policy
 * - exits non-zero when gaps exist
 */
import { readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const fullSql = files
  .map((f) => readFileSync(resolve(migrationsDir, f), "utf8"))
  .join("\n");

const normalized = fullSql.toLowerCase();

const createTableRegex =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(public)\.)?([a-z_][a-z0-9_]*)/g;

const tables = new Set();
for (const match of normalized.matchAll(createTableRegex)) {
  const table = match[2];
  if (!table) continue;
  tables.add(table);
}

const skipTables = new Set([
  "schema_migrations",
]);

const missingRls = [];
const missingPolicies = [];

for (const table of [...tables].sort()) {
  if (skipTables.has(table)) continue;

  const hasRls = normalized.includes(`alter table ${table} enable row level security`)
    || normalized.includes(`alter table if exists ${table} enable row level security`)
    || normalized.includes(`alter table public.${table} enable row level security`);

  const hasPolicy =
    normalized.includes(`create policy `) &&
    (normalized.includes(` on ${table} `) ||
      normalized.includes(` on ${table}\n`) ||
      normalized.includes(` on public.${table} `) ||
      normalized.includes(` on public.${table}\n`));

  if (!hasRls) missingRls.push(table);
  if (!hasPolicy) missingPolicies.push(table);
}

if (missingRls.length > 0) {
  console.error("Tables without RLS enabled:");
  for (const t of missingRls) console.error(` - ${t}`);
}

if (missingPolicies.length > 0) {
  console.error("Tables without policies:");
  for (const t of missingPolicies) console.error(` - ${t}`);
}

if (missingRls.length > 0 || missingPolicies.length > 0) {
  process.exit(1);
}

console.log(`RLS/policy verification passed for ${tables.size} tables.`);
