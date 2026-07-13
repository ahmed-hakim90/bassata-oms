"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CASHIER_COOKIE,
  clearActiveStoreCookie,
  setActiveStoreCookie,
} from "@/lib/auth/session";
import * as userRepo from "@/lib/repositories/user.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { isOrganizationSuspended } from "@/lib/org-status";
import {
  isPlatformAdminEmail,
  resolvePlatformAdmin,
} from "@/modules/platform/services/platform-admin.service";

export interface LoginResult {
  success: boolean;
  error?: string;
}

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { success: false, error: "البريد الإلكتروني وكلمة المرور مطلوبان." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    await writeAuthFailureAudit(email, "invalid_credentials");
    return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  }

  const appUser = await userRepo.getUserByAuthId(data.user.id);

  if (!appUser || !appUser.is_active) {
    // Platform control-plane admins may have no tenant membership.
    if (await isPlatformAdminEmail(email)) {
      await resolvePlatformAdmin();
      const cookieStore = await cookies();
      cookieStore.delete(CASHIER_COOKIE);
      await clearActiveStoreCookie();
      redirect("/platform");
    }
    await supabase.auth.signOut();
    await writeAuthFailureAudit(email, "inactive_or_unprovisioned");
    return { success: false, error: "الحساب غير نشط أو غير مُهيأ." };
  }
  if (await isOrganizationSuspended(appUser.org_id)) {
    await supabase.auth.signOut();
    await writeAuthFailureAudit(email, "company_suspended");
    return { success: false, error: "تم تعليق الشركة. تواصل مع الدعم." };
  }

  const cookieStore = await cookies();
  cookieStore.delete(CASHIER_COOKIE);

  const defaultStoreId = appUser.store_ids[0] ?? null;
  if (defaultStoreId && appUser.role !== "inventory") {
    await setActiveStoreCookie(defaultStoreId);
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: defaultStoreId,
    userId: appUser.id,
    action: "auth.login",
    entityType: "user",
    entityId: appUser.id,
    metadata: { email: appUser.email, role: appUser.role },
  });

  // Tenant users who are also platform admins land on tenant home; /platform remains available.
  if (appUser.role === "cashier") {
    redirect("/pos");
  }

  redirect("/");
}

async function writeAuthFailureAudit(email: string, reason: string) {
  try {
    const orgId = await getOrgId();
    const users = await userRepo.listUsers();
    const actor = users.find((u) => u.role === "owner") ?? users[0];
    if (!actor) return;
    await writeAuditLog({
      orgId,
      userId: actor.id,
      action: "auth.login_failed",
      entityType: "user",
      entityId: actor.id,
      metadata: { email, reason },
    });
  } catch {
    // No org context (e.g. pre-onboarding)
  }
}
