import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as userRepo from "@/lib/repositories/user.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { isPlatformAdminAuthUser } from "@/lib/platform/auth";
import { isOrganizationSuspended } from "@/lib/platform/company-status";
import { writePlatformAuditLog } from "@/modules/platform/services/platform.service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (await isPlatformAdminAuthUser(data.user.id, data.user.email)) {
    await writePlatformAuditLog({
      action: "platform.auth.login",
      entityType: "platform_admin",
      entityId: data.user.id,
      metadata: { email: data.user.email, via: "oauth_callback" },
    });
    return NextResponse.redirect(`${origin}/platform`);
  }

  const appUser = await userRepo.getUserByAuthId(data.user.id);
  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=provisioned`);
  }
  if (await isOrganizationSuspended(appUser.org_id)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=suspended`);
  }

  try {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      storeId: appUser.store_ids[0] ?? null,
      userId: appUser.id,
      action: "auth.login",
      entityType: "user",
      entityId: appUser.id,
      metadata: { email: appUser.email, role: appUser.role, via: "oauth_callback" },
    });
  } catch {
    // Org may not exist during onboarding edge cases
  }

  return NextResponse.redirect(`${origin}${next}`);
}
