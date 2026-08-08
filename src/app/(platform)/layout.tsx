export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/Velora/access-denied";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { PlatformShell } from "@/modules/platform/components/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login?from=/platform");

  const platformAdmin = await resolvePlatformAdmin();
  if (!platformAdmin) {
    const tenantUser = await getCurrentUser();
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-[var(--mds-space-4)] py-[var(--mds-space-12)]">
        <AccessDenied
          title="مفيش صلاحية"
          description={
            tenantUser
              ? "لوحة المنصة للمشرّفين فقط. حساب الشركة مش هيقدر يفتح الصفحة دي."
              : "مفيش صلاحية لمنصة الإدارة. لو المفروض عندك صلاحية، تأكد من PLATFORM_BOOTSTRAP_EMAILS."
          }
        />
      </div>
    );
  }

  return (
    <PlatformShell
      adminEmail={platformAdmin.email}
      adminName={platformAdmin.name || platformAdmin.email}
    >
      {children}
    </PlatformShell>
  );
}
