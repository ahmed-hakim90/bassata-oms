"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";

export interface PasswordActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function forgotPasswordAction(
  _prev: PasswordActionResult | null,
  formData: FormData
): Promise<PasswordActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { success: false, error: "Email is required." };
  }

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { success: false, error: "Could not send reset email. Try again later." };
  }

  return {
    success: true,
    message: "If an account exists for that email, you will receive a reset link shortly.",
  };
}

export async function resetPasswordAction(
  _prev: PasswordActionResult | null,
  formData: FormData
): Promise<PasswordActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { success: false, error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Reset link expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { success: false, error: error.message };
  }

  redirect("/login?reset=1");
}

export async function changePasswordAction(
  _prev: PasswordActionResult | null,
  formData: FormData
): Promise<PasswordActionResult> {
  const appUser = await requireAuth();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { success: false, error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { success: false, error: error.message };
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId: appUser.id,
    action: "auth.password_changed",
    entityType: "user",
    entityId: appUser.id,
  });

  return { success: true, message: "Password updated." };
}
