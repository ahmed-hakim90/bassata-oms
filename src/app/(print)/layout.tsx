export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { canPrintReports } from "@/lib/constants";
import { PrintToolbar } from "@/modules/reports/components/print-toolbar";

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let permissions;
  try {
    user = await ensureTenantUser(await getCurrentUser());
    permissions = await getEffectivePermissions(user);
  } catch (error) {
    redirectOnAuthFailure(error, "/reports");
  }

  if (!canPrintReports(user.role, permissions)) {
    redirect("/reports");
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <PrintToolbar />
      {children}
    </div>
  );
}
