"use server";

import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";

export async function openCashDrawerAction(reason?: string) {
  const user = await requirePermissionOrRole("checkout_create", ["owner", "manager"]);
  const ctx = await requirePosAccess();
  await requireFeature("cash_drawer");

  if (user.role !== "owner" && user.role !== "manager") {
    throw new Error("Owner or manager override required");
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: ctx.storeId,
    userId: user.id,
    action: "pos.manager_override.cash_drawer_open",
    entityType: "device",
    entityId: ctx.deviceId ?? ctx.storeId,
    metadata: {
      activeCashierId: ctx.activeCashierId,
      reason: reason?.trim() || null,
    },
  });

  return { success: true };
}
