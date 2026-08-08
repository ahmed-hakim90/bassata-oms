import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

/** One-time magic login link for a tenant user (impersonation assist). */
export async function createTenantImpersonationLink(
  platformAdmin: PlatformAdmin,
  userId: string
): Promise<{ actionLink: string; email: string; orgId: string }> {
  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, email, name, is_active, auth_user_id, organizations!inner(status)")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");
  if (!user.is_active) throw new Error("المستخدم موقوف — فعّله قبل الدخول كحسابه");
  if (!user.auth_user_id) throw new Error("المستخدم مفيش له حساب Auth");

  const org = user.organizations as unknown as { status: string };
  if (org?.status === "suspended") {
    throw new Error("الشركة معلّقة — مش هينفع الدخول كحساب منها");
  }

  const redirectTo = `${getSiteUrl()}/auth/callback?next=/`;
  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo },
  });
  if (linkError) throw new Error(linkError.message);

  const actionLink = data?.properties?.action_link?.trim();
  if (!actionLink) throw new Error("مقدرناش نولّد لينك الدخول");

  await auditAs(platformAdmin, {
    action: "user.impersonate_link",
    entityType: "user",
    entityId: user.id,
    metadata: {
      org_id: user.org_id,
      email: user.email,
      name: user.name,
      redirect_to: redirectTo,
    },
  });

  return { actionLink, email: user.email, orgId: user.org_id };
}
