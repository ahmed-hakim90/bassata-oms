/**
 * Creates the production admin Supabase Auth user and links it to the app user.
 * Run after: supabase db reset (or seed.sql applied)
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL,
 * and ADMIN_PASSWORD in the environment or .env.local.
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
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME?.trim() || "مدير النظام";
const adminAppUserId = "00000000-0000-4000-8000-000000000201";

if (!url || !serviceKey) {
  console.error(
    "Missing env in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

if (!adminEmail || !adminPassword) {
  console.error(
    "Missing env: ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the admin user."
  );
  process.exit(1);
}

if (adminPassword.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
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

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const found = await findUserByEmail(adminEmail);

  let authUserId = found?.id;
  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: "owner" },
    });
    if (error) throw error;
    authUserId = data.user.id;
    console.log(`Created admin auth user: ${adminEmail}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: "owner" },
    });
    if (error) throw error;
    console.log(`Updated existing admin auth user: ${adminEmail}`);
  }

  const { error: linkError } = await admin
    .from("users")
    .update({
      auth_user_id: authUserId,
      email: adminEmail,
      name: adminName,
      role: "owner",
      is_active: true,
    })
    .eq("id", adminAppUserId);

  if (linkError) throw linkError;

  console.log(`Linked admin app user ${adminAppUserId} -> ${authUserId}`);
}

main().catch((error) => {
  console.error("Failed to seed admin auth user:", error.message);
  process.exit(1);
});
