import * as costCenterRepo from "@/lib/repositories/cost-center.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { CostCenter, CostCenterType } from "@/lib/types";

export async function listCostCenters(storeId?: string): Promise<CostCenter[]> {
  return costCenterRepo.listCostCenters(storeId);
}

export async function getCostCenter(id: string): Promise<CostCenter | null> {
  return costCenterRepo.getCostCenter(id);
}

export async function createCostCenter(
  input: {
    name: string;
    code: string;
    type: CostCenterType;
    store_id?: string | null;
  },
  userId: string
): Promise<CostCenter> {
  const center = await costCenterRepo.createCostCenter(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "cost_center.created",
    entityType: "cost_center",
    entityId: center.id,
    metadata: { name: center.name, code: center.code },
  });
  return center;
}

export async function updateCostCenter(
  id: string,
  patch: Partial<Pick<CostCenter, "name" | "code" | "type" | "is_active" | "store_id">>,
  userId: string
): Promise<CostCenter | null> {
  const center = await costCenterRepo.updateCostCenter(id, patch);
  if (center) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "cost_center.edited",
      entityType: "cost_center",
      entityId: id,
      metadata: patch,
    });
  }
  return center;
}
