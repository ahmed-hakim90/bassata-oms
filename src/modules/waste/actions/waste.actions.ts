"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  listWasteWithProducts,
  getWasteSummary,
  recordWaste,
} from "@/modules/waste/services/waste.service";

export async function recordWasteAction(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  reasonCode: string;
  notes: string;
}) {
  await requireFeature("waste");
  const user = await requirePermissionOrRole("waste_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const record = await recordWaste({
    ...input,
    storeId,
    createdBy: user.id,
  });
  revalidatePath("/inventory/waste");
  revalidatePath("/inventory");
  return record;
}

export async function getWasteData() {
  await requireFeature("waste");
  await requirePermissionOrRole("waste_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const records = await listWasteWithProducts(storeId);
  const products = await catalogRepo.listProducts({ activeOnly: true });
  const warehouses = await warehouseRepo.listWarehouses(storeId);
  return {
    records,
    summary: getWasteSummary(records),
    products: products.filter((p) => p.track_inventory),
    warehouses,
    storeId,
  };
}
