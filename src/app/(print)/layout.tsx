export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { canPrintReports } from "@/lib/constants";
import { PrintToolbar } from "@/modules/reports/components/print-toolbar";

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const permissions = await getEffectivePermissions(user);
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
