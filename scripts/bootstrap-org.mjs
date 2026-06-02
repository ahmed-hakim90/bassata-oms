#!/usr/bin/env node
/**
 * Headless first-org bootstrap (empty database only).
 * Prefer the /onboarding UI for production owners.
 *
 * Usage:
 *   node scripts/bootstrap-org.mjs --email owner@shop.com --password 'secret123' \
 *     --org "My Shop" --store "Main Street"
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

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const email = arg("--email");
const password = arg("--password");
const orgName = arg("--org") ?? "SweetFlow Organization";
const storeName = arg("--store") ?? "Main Store";

if (!email || !password) {
  console.error("Required: --email and --password");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authData, error: authError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (authError || !authData.user) {
  console.error("Auth user failed:", authError?.message);
  process.exit(1);
}

const { data, error } = await admin.rpc("initialize_organization", {
  p_org_name: orgName,
  p_currency: "USD",
  p_timezone: "UTC",
  p_country: "",
  p_store_name: storeName,
  p_store_address: "",
  p_owner_name: email.split("@")[0] ?? "Owner",
  p_owner_email: email,
  p_auth_user_id: authData.user.id,
  p_feature_flags: {},
});

if (error) {
  console.error("initialize_organization failed:", error.message);
  process.exit(1);
}

console.log("Organization bootstrapped:", data);
console.log("Sign in at /login with", email);
