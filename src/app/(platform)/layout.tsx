export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/SweetFlow/access-denied";
import { APP_NAME } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { resolvePlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-dvh bg-[var(--mds-color-bg-canvas)]" dir="rtl">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-[var(--mds-space-4)] px-[var(--mds-space-4)] py-[var(--mds-space-3)] md:px-[var(--mds-space-6)]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">لوحة التحكم · المنصة</p>
            <Link href="/platform" className="truncate text-base font-semibold text-foreground">
              {APP_NAME} Platform
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-[var(--mds-space-2)]">
            <span className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:inline">
              {platformAdmin.email}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                تسجيل الخروج
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-[var(--mds-space-4)] py-[var(--mds-space-6)] md:px-[var(--mds-space-6)]">
        {children}
      </main>
    </div>
  );
}
