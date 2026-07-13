/**
 * Seeds Supabase Auth users and links them to app `users` rows.
 * Run after: supabase db reset (or seed.sql applied)
 *
 * Always seeds CafeFlow demo accounts expected by verify:* / E2E
 * (owner@CafeFlow.local, cashier1@…, password demo1234). See docs/DEMO_USERS.md.
 *
 * Optional production admin (ADMIN_EMAIL + ADMIN_PASSWORD ≥12 chars):
 * creates/updates that Auth user without overwriting the demo owner link
 * unless ADMIN_EMAIL equals owner@CafeFlow.local.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename, { overwrite = false } = {}) {
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
    if (overwrite || process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
// Prefer .env.local (Next.js convention) so local overrides match the running app.
loadEnvFile(".env.local", { overwrite: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME?.trim() || "مدير النظام";
const adminAppUserId = "00000000-0000-4000-8000-000000000201";
const demoPassword = process.env.DEMO_PASSWORD ?? "demo1234";

/** Canonical verify / E2E demo accounts (must match seed.sql app user ids). */
const DEMO_USERS = [
  {
    appId: "00000000-0000-4000-8000-000000000201",
    email: "owner@CafeFlow.local",
    name: "Alex Owner",
    role: "owner",
  },
  {
    appId: "00000000-0000-4000-8000-000000000202",
    email: "manager@CafeFlow.local",
    name: "Maya Manager",
    role: "manager",
  },
  {
    appId: "00000000-0000-4000-8000-000000000203",
    email: "cashier1@CafeFlow.local",
    name: "Sam Cashier",
    role: "cashier",
  },
  {
    appId: "00000000-0000-4000-8000-000000000204",
    email: "cashier2@CafeFlow.local",
    name: "Jordan Cashier",
    role: "cashier",
  },
  {
    appId: "00000000-0000-4000-8000-000000000205",
    email: "inventory@CafeFlow.local",
    name: "Riley Inventory",
    role: "inventory",
  },
  {
    appId: "00000000-0000-4000-8000-000000000206",
    email: "viewer@CafeFlow.local",
    name: "Pat Viewer",
    role: "viewer",
  },
];

if (!url || !serviceKey) {
  console.error(
    "Missing env in .env.local: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

if (adminEmail || adminPassword) {
  if (!adminEmail || !adminPassword) {
    console.error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must both be set when seeding a production admin."
    );
    process.exit(1);
  }
  if (adminPassword.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }
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
  const normalized = email.toLowerCase();

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAuthUser(email, password, role) {
  const found = await findUserByEmail(email);
  let authUserId = found?.id;

  if (!authUserId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });
    if (error) throw error;
    authUserId = data.user.id;
    console.log(`Created auth user: ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      app_metadata: { role },
    });
    if (error) throw error;
    console.log(`Updated auth user: ${email}`);
  }

  return authUserId;
}

async function linkAppUser(appId, authUserId, { email, name, role }) {
  const { data: existing, error: selectError } = await admin
    .from("users")
    .select("id")
    .eq("id", appId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (!existing) {
    console.warn(
      `Skipped link for ${email}: app user ${appId} missing (run seed.sql / db reset first)`
    );
    return false;
  }

  const { error: linkError } = await admin
    .from("users")
    .update({
      auth_user_id: authUserId,
      email,
      name,
      role,
      is_active: true,
    })
    .eq("id", appId);

  if (linkError) throw linkError;
  console.log(`Linked ${email} → ${appId}`);
  return true;
}

async function main() {
  console.log("→ Seeding CafeFlow demo Auth users…");
  for (const u of DEMO_USERS) {
    const authUserId = await ensureAuthUser(u.email, demoPassword, u.role);
    await linkAppUser(u.appId, authUserId, u);
  }

  if (adminEmail) {
    const isDemoOwner = adminEmail === "owner@cafeflow.local";
    console.log(`→ Seeding optional ADMIN_EMAIL (${adminEmail})…`);
    const authUserId = await ensureAuthUser(adminEmail, adminPassword, "owner");

    if (isDemoOwner) {
      await linkAppUser(adminAppUserId, authUserId, {
        email: adminEmail,
        name: adminName,
        role: "owner",
      });
    } else {
      // Production-style admin Auth account. Do not steal the demo owner app row.
      const { data: byEmail } = await admin
        .from("users")
        .select("id")
        .eq("email", adminEmail)
        .maybeSingle();

      if (byEmail?.id) {
        const { error } = await admin
          .from("users")
          .update({
            auth_user_id: authUserId,
            name: adminName,
            role: "owner",
            is_active: true,
          })
          .eq("id", byEmail.id);
        if (error) throw error;
        console.log(`Linked ADMIN_EMAIL to existing app user ${byEmail.id}`);
      } else {
        console.log(
          `Admin Auth ready (${adminEmail}). No app users.email match — link manually or use demo owner@CafeFlow.local for verify:*`
        );
      }
    }
  }

  console.log("\nDemo login password:", demoPassword);
  console.log("Demo emails: owner / manager / cashier1 / cashier2 / inventory / viewer @CafeFlow.local");
}

main().catch((error) => {
  console.error("Failed to seed auth users:", error.message);
  process.exit(1);
});
