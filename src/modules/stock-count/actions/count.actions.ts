"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  listStockCounts,
  postCountAdjustments,
  startStockCount,
  submitCountLines,
} from "@/modules/stock-count/services/count.service";

export async function startCountAction(warehouseId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const count = await startStockCount({ storeId, warehouseId, createdBy: user.id });
  revalidatePath("/inventory/stock-count");
  return count;
}

export async function submitCountLinesAction(
  countId: string,
  lines: { productId: string; countedQty: number }[]
) {
  await requireFeature("stock_count");
  await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  const count = await submitCountLines(countId, lines);
  revalidatePath("/inventory/stock-count");
  return count;
}

export async function postCountAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  await postCountAdjustments(countId, user.id);
  revalidatePath("/inventory/stock-count");
  revalidatePath("/inventory");
}

export async function getStockCountData() {
  await requireFeature("stock_count");
  await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const counts = await listStockCounts(storeId);
  const active = counts.find((c) => c.status === "in_progress") ?? null;
  const warehouses = await warehouseRepo.listWarehouses(storeId);
  return {
    counts,
    activeCount: active,
    products: await catalogRepo.listProducts({ activeOnly: true }),
    warehouses,
    storeId,
  };
}
