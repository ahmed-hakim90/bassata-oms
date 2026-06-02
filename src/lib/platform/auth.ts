import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformBootstrapEmail } from "@/lib/platform/bootstrap";

export class PlatformAuthError extends Error {
  constructor(
    message: string,
    public status = 403
  ) {
    super(message);
    this.name = "PlatformAuthError";
  }
}

export interface PlatformAdmin {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  is_active: boolean;
}

async function findPlatformAdmin(authUserId: string, email: string): Promise<PlatformAdmin | null> {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data: byAuth, error: authError } = await admin
    .from("platform_admins")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (authError) throw new PlatformAuthError(authError.message, 500);
  if (byAuth) return byAuth as PlatformAdmin;

  const { data, error } = await admin
    .from("platform_admins")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) throw new PlatformAuthError(error.message, 500);
  if (!data) return null;
  if (!data.auth_user_id) {
    const { data: updated, error: updateError } = await admin
      .from("platform_admins")
      .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (updateError) throw new PlatformAuthError(updateError.message, 500);
    return updated as PlatformAdmin;
  }
  return data as PlatformAdmin;
}

async function ensureAllowlistedPlatformAdmin(
  authUserId: string,
  email: string,
  name?: string
): Promise<PlatformAdmin | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isPlatformBootstrapEmail(normalizedEmail)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_admins")
    .upsert(
      {
        auth_user_id: authUserId,
        email: normalizedEmail,
        name: name ?? normalizedEmail,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select()
    .single();
  if (error) throw new PlatformAuthError(error.message, 500);
  return data as PlatformAdmin;
}

export async function getCurrentPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const existing = await findPlatformAdmin(user.id, user.email);
  if (existing?.is_active) return existing;
  if (existing && !existing.is_active) return null;
  return ensureAllowlistedPlatformAdmin(
    user.id,
    user.email,
    user.user_metadata?.name as string | undefined
  );
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const platformAdmin = await getCurrentPlatformAdmin();
  if (!platformAdmin) throw new PlatformAuthError("Platform admin access required", 403);
  return platformAdmin;
}

export async function isPlatformAdminAuthUser(authUserId: string, email?: string | null): Promise<boolean> {
  if (!email) return false;
  const existing = await findPlatformAdmin(authUserId, email);
  if (existing) return existing.is_active;
  const ensured = await ensureAllowlistedPlatformAdmin(authUserId, email);
  return Boolean(ensured?.is_active);
}
