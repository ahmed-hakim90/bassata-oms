"use server";

import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import { requirePosAccess } from "@/lib/auth/pos-access";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertManagerOverridePin } from "@/modules/pos/services/manager-override.service";

export async function openCashDrawerAction(input: { reason?: string; pin?: string }) {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const ctx = await requirePosAccess();
  await requireFeature("cash_drawer");

  const approver = await assertManagerOverridePin({
    storeId: ctx.storeId,
    deviceId: ctx.deviceId,
    pin: input.pin,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: ctx.storeId,
    userId: approver.managerId,
    action: "pos.manager_override.cash_drawer_open",
    entityType: "device",
    entityId: ctx.deviceId ?? ctx.storeId,
    metadata: {
      activeCashierId: ctx.activeCashierId,
      reason: input.reason?.trim() || null,
    },
  });

  return { success: true };
}