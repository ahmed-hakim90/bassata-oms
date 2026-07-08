/**
 * Reset a Supabase Auth password without email recovery.
 * Usage:
 *   USER_EMAIL=hema@bassata.com USER_PASSWORD='NewPass123!' npm run db:reset-user-password
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
const email = process.env.USER_EMAIL?.trim().toLowerCase();
const password = process.env.USER_PASSWORD;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!email || !password) {
  console.error("Usage: USER_EMAIL=user@example.com USER_PASSWORD='your-password' npm run db:reset-user-password");
  process.exit(1);
}

if (password.length < 8) {
  console.error("USER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const authUser = await findUserByEmail(email);
  if (!authUser) {
    console.error(`No Supabase Auth user found for ${email}`);
    process.exit(1);
  }

  const { error } = await admin.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;

  console.log(`Password updated for ${email}`);
}

main().catch((error) => {
  console.error("Failed to reset password:", error.message);
  process.exit(1);
});
