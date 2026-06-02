/**
 * Creates Supabase Auth users and links them to app users.
 * Run after: supabase db reset (or seed.sql applied)
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in .env.local
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
  console.error(
    "Missing env in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

try {
  const payload = JSON.parse(
    Buffer.from(serviceKey.split(".")[1], "base64url").toString("utf8")
  );
  if (payload.role !== "service_role") {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY must be the service_role key (Supabase Dashboard → Settings → API), not the anon key."
    );
    process.exit(1);
  }
} catch {
  console.warn("Could not verify service role JWT; continuing anyway.");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { appId: "00000000-0000-4000-8000-000000000201", email: "owner@SweetFlow.local", password: "demo1234" },
  { appId: "00000000-0000-4000-8000-000000000202", email: "manager@SweetFlow.local", password: "demo1234" },
  { appId: "00000000-0000-4000-8000-000000000203", email: "cashier1@SweetFlow.local", password: "demo1234" },
  { appId: "00000000-0000-4000-8000-000000000204", email: "cashier2@SweetFlow.local", password: "demo1234" },
  { appId: "00000000-0000-4000-8000-000000000205", email: "inventory@SweetFlow.local", password: "demo1234" },
  { appId: "00000000-0000-4000-8000-000000000206", email: "viewer@SweetFlow.local", password: "demo1234" },
];

async function main() {
  for (const u of USERS) {
    const { data: existing } = await admin.auth.admin.listUsers();
    const found = existing?.users?.find((x) => x.email === u.email);

    let authUserId = found?.id;
    if (!authUserId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`Failed to create ${u.email}:`, error.message);
        continue;
      }
      authUserId = data.user.id;
      console.log(`Created auth user: ${u.email}`);
    } else {
      console.log(`Auth user exists: ${u.email}`);
    }

    const { error: linkError } = await admin
      .from("users")
      .update({ auth_user_id: authUserId })
      .eq("id", u.appId);

    if (linkError) {
      console.error(`Failed to link ${u.email}:`, linkError.message);
    } else {
      console.log(`Linked app user ${u.appId} -> ${authUserId}`);
    }
  }
}

main();
