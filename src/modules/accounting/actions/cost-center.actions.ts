"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireStoreAccess } from "@/lib/auth/guards";
import {
  createCostCenter,
  updateCostCenter,
  listCostCenters,
} from "@/modules/accounting/services/cost-center.service";
import type { CostCenterType } from "@/lib/types";

export async function getCostCentersData(storeId?: string) {
  await requirePermission("cost_center_manage");
  if (storeId) {
    await requireStoreAccess(storeId);
  }
  const centers = await listCostCenters(storeId);
  return { centers };
}

export async function createCostCenterAction(input: {
  name: string;
  code: string;
  type: CostCenterType;
  store_id?: string | null;
}) {
  const user = await requirePermission("cost_center_manage");
  if (input.store_id) {
    await requireStoreAccess(input.store_id);
  }
  const center = await createCostCenter(input, user.id);
  revalidatePath("/settings/cost-centers");
  revalidatePath("/settings");
  return center;
}

export async function updateCostCenterAction(
  id: string,
  patch: {
    name?: string;
    code?: string;
    type?: CostCenterType;
    is_active?: boolean;
    store_id?: string | null;
  }
) {
  const user = await requirePermission("cost_center_manage");
  if (patch.store_id) {
    await requireStoreAccess(patch.store_id);
  }
  const center = await updateCostCenter(id, patch, user.id);
  revalidatePath("/settings/cost-centers");
  revalidatePath("/settings");
  return center;
}

export async function toggleCostCenterAction(id: string, isActive: boolean) {
  return updateCostCenterAction(id, { is_active: isActive });
}
