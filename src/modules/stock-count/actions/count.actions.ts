"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  approveStockCount,
  isActiveStockCountStatus,
  listStockCounts,
  postCountAdjustments,
  rejectStockCountApproval,
  startStockCount,
  submitCountForApproval,
  submitCountLines,
  syncCountLines,
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

export async function submitCountForApprovalAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  await submitCountForApproval(countId, user.id);
  revalidatePath("/inventory/stock-count");
}

/** Approval gate — owner/manager only (inventory can count/submit, not approve). */
export async function approveCountAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager"]);
  await approveStockCount(countId, user.id);
  revalidatePath("/inventory/stock-count");
}

export async function rejectCountApprovalAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager"]);
  await rejectStockCountApproval(countId, user.id);
  revalidatePath("/inventory/stock-count");
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
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  const storeId = await getValidatedActiveStoreId();
  const counts = await listStockCounts(storeId);
  let active = counts.find((c) => isActiveStockCountStatus(c.status)) ?? null;
  // Heal empty in-progress counts (e.g. started before tracked products existed).
  if (active?.status === "in_progress") {
    try {
      active = { ...active, lines: await syncCountLines(active) };
    } catch (error) {
      console.error("stock_count.syncCountLines failed", error);
    }
  }
  const warehouses = await warehouseRepo.listWarehouses(storeId);
  const canApprove = user.role === "owner" || user.role === "manager";
  const products = await catalogRepo.listProducts({ activeOnly: true });
  return {
    counts,
    activeCount: active,
    products,
    trackedProductCount: products.filter((p) => p.track_inventory).length,
    warehouses,
    storeId,
    canApprove,
  };
}
