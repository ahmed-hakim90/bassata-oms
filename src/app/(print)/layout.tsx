export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureTenantUser } from "@/lib/auth/ensure-tenant-user";
import { redirectOnAuthFailure } from "@/lib/auth/redirect-on-auth-failure";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import {
  canPrintBarcodeLabels,
  canPrintCommercialDocuments,
  canPrintReports,
  canPrintStockCount,
} from "@/lib/constants";
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

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const search = headerList.get("x-search") ?? "";
  const embed = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("embed") === "1";
  const isLabelPrint = pathname === "/print/labels" || pathname.startsWith("/print/labels/");
  const isStockCountPrint =
    pathname === "/print/stock-count" || pathname.startsWith("/print/stock-count/");
  const isCommercialPrint =
    pathname.startsWith("/print/orders") ||
    pathname.startsWith("/print/receipts") ||
    pathname.startsWith("/print/purchases");
  const allowed = isLabelPrint
    ? canPrintBarcodeLabels(user.role, permissions)
    : isStockCountPrint
      ? canPrintStockCount(user.role, permissions)
      : isCommercialPrint
        ? canPrintCommercialDocuments(user.role, permissions)
        : canPrintReports(user.role, permissions);

  if (!allowed) {
    redirect(
      isLabelPrint
        ? "/labels"
        : isStockCountPrint
          ? "/inventory/stock-count"
          : isCommercialPrint
            ? "/pos"
            : "/reports"
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {embed ? null : <PrintToolbar />}
      {children}
    </div>
  );
}
