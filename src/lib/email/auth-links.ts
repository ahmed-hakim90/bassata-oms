import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

export function appLoginUrl(origin?: string): string {
  const base = (origin ?? getSiteUrl()).replace(/\/$/, "");
  return `${base}/login`;
}

export function passwordResetRedirectTo(origin?: string): string {
  const base = (origin ?? getSiteUrl()).replace(/\/$/, "");
  return `${base}/auth/callback?next=/reset-password`;
}

export function platformInviteUrl(token: string): string {
  return `${getSiteUrl()}/onboarding?invite=${encodeURIComponent(token)}`;
}

/** Supabase recovery action link, or null if the user cannot receive one. */
export async function generateRecoveryActionLink(
  email: string,
  redirectTo?: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: redirectTo ?? passwordResetRedirectTo(),
    },
  });

  if (error) {
    console.warn("[email] generateLink recovery failed", error.message);
    return null;
  }

  const link = data?.properties?.action_link?.trim();
  return link || null;
}
