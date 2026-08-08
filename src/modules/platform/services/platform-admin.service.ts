import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type PlatformAdmin = Database["public"]["Tables"]["platform_admins"]["Row"];

function parseBootstrapEmails(): Set<string> {
  const raw = process.env.PLATFORM_BOOTSTRAP_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isBootstrapPlatformEmail(email: string): boolean {
  return parseBootstrapEmails().has(email.trim().toLowerCase());
}

/** Resolve active platform admin for the current auth session (service_role). Bootstraps from env emails. */
export const resolvePlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("platform_admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    throw new Error(`platform_admins lookup failed: ${existingError.message}`);
  }

  if (existing) {
    if (!existing.is_active) return null;
    if (existing.auth_user_id !== user.id) {
      const { data: linked, error: linkError } = await admin
        .from("platform_admins")
        .update({
          auth_user_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (linkError) throw new Error(`platform_admins link failed: ${linkError.message}`);
      return linked;
    }
    return existing;
  }

  if (!isBootstrapPlatformEmail(email)) return null;

  const metaName = user.user_metadata?.full_name;
  const displayName =
    typeof metaName === "string" && metaName.trim()
      ? metaName.trim()
      : email.split("@")[0] || "Platform Admin";

  const { data: created, error: createError } = await admin
    .from("platform_admins")
    .upsert(
      {
        email,
        auth_user_id: user.id,
        name: displayName,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();

  if (createError) {
    throw new Error(`platform_admins bootstrap failed: ${createError.message}`);
  }
  return created;
});

/** True when email may access platform (row or bootstrap list). Does not require session. */
export async function isPlatformAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (isBootstrapPlatformEmail(normalized)) return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("id")
    .eq("email", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`platform_admins email check failed: ${error.message}`);
  return Boolean(data);
}

export async function listPlatformAdmins(): Promise<PlatformAdmin[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`platform_admins list failed: ${error.message}`);
  return data ?? [];
}

/** Grant platform access to an existing Auth user (must already exist in Supabase Auth). */
export async function upsertPlatformAdmin(
  actor: PlatformAdmin,
  input: { email: string; name?: string; isActive?: boolean }
): Promise<PlatformAdmin> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("البريد الإلكتروني غير صالح");

  const admin = createAdminClient();
  let authUser: { id: string; user_metadata?: Record<string, unknown> } | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) throw new Error(listError.message);
    const found = listed.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      authUser = found;
      break;
    }
    if (listed.users.length < 200) break;
  }
  if (!authUser) {
    throw new Error(
      "مفيش حساب Auth بهذا الإيميل. أنشئ المستخدم في Authentication أولاً أو خلّيه يسجّل دخول مرة."
    );
  }

  const name =
    input.name?.trim() ||
    (typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name.trim()
      : "") ||
    email.split("@")[0] ||
    "Platform Admin";

  const { data, error } = await admin
    .from("platform_admins")
    .upsert(
      {
        email,
        auth_user_id: authUser.id,
        name,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "فشل حفظ مشرف المنصة");
  }

  const { auditAs } = await import("@/modules/platform/services/platform-audit.service");
  await auditAs(actor, {
    action: "platform_admin.upsert",
    entityType: "platform_admin",
    entityId: data.id,
    metadata: { email, name, is_active: data.is_active },
  });

  return data;
}

export async function setPlatformAdminActive(
  actor: PlatformAdmin,
  platformAdminId: string,
  isActive: boolean
): Promise<void> {
  if (actor.id === platformAdminId && !isActive) {
    throw new Error("مش هتقدر تعطّل حسابك وأنت داخل بيه");
  }

  const admin = createAdminClient();
  const { data: target, error: lookupError } = await admin
    .from("platform_admins")
    .select("id, email, is_active")
    .eq("id", platformAdminId)
    .maybeSingle();
  if (lookupError || !target) {
    throw new Error(lookupError?.message ?? "مشرف المنصة غير موجود");
  }

  if (!isActive) {
    const { count, error: countError } = await admin
      .from("platform_admins")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .neq("id", platformAdminId);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) === 0) {
      throw new Error("لازم يفضل مشرف منصة نشط واحد على الأقل");
    }
  }

  const { error } = await admin
    .from("platform_admins")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", platformAdminId);
  if (error) throw new Error(error.message);

  const { auditAs } = await import("@/modules/platform/services/platform-audit.service");
  await auditAs(actor, {
    action: isActive ? "platform_admin.activate" : "platform_admin.deactivate",
    entityType: "platform_admin",
    entityId: platformAdminId,
    metadata: { email: target.email },
  });
}
