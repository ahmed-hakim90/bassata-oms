"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  requireFeature,
  requirePermissionOrRole,
  getValidatedActiveStoreId,
  requireStoreAccess,
} from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
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
import {
  getCountSessionPrint,
  getCountSheet,
} from "@/modules/stock-count/services/count-sheet.service";

const countLinesSchema = z
  .array(
    z.object({
      productId: z.string().min(1).max(80),
      countedQty: z.number().finite().min(0).max(1_000_000),
    })
  )
  .max(5000);

const startCountSchema = z.object({
  warehouseId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  countFromZero: z.boolean().optional(),
});

const countSheetFiltersSchema = z.object({
  storeId: z.string().min(1).optional(),
  warehouseId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
});

function accessibleStores(
  stores: Awaited<ReturnType<typeof storeRepo.listStores>>,
  user: { role: string; store_ids: string[] }
) {
  if (user.role === "owner" || user.role === "manager") return stores;
  return stores.filter((store) => user.store_ids.includes(store.id));
}

export async function startCountAction(input: {
  warehouseId: string;
  categoryId?: string;
  productId?: string;
  countFromZero?: boolean;
}) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  const storeId = await getValidatedActiveStoreId();
  const parsed = startCountSchema.parse(input);
  const count = await startStockCount({
    storeId,
    warehouseId: parsed.warehouseId,
    createdBy: user.id,
    categoryId: parsed.categoryId,
    productId: parsed.productId,
    countFromZero: parsed.countFromZero,
  });
  revalidatePath("/inventory/stock-count");
  return count;
}

export async function submitCountLinesAction(
  countId: string,
  lines: { productId: string; countedQty: number }[]
) {
  await requireFeature("stock_count");
  await requirePermissionOrRole("stock_count_manage", ["owner", "manager", "inventory"]);
  const parsedCountId = z.string().min(1).parse(countId);
  const parsedLines = countLinesSchema.parse(lines);
  const count = await submitCountLines(parsedCountId, parsedLines);
  revalidatePath("/inventory/stock-count");
  return count;
}

export async function submitCountForApprovalAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  await submitCountForApproval(z.string().min(1).parse(countId), user.id);
  revalidatePath("/inventory/stock-count");
}

/** Approval gate — owner/manager only (inventory can count/submit, not approve). */
export async function approveCountAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager"]);
  await approveStockCount(z.string().min(1).parse(countId), user.id);
  revalidatePath("/inventory/stock-count");
}

export async function rejectCountApprovalAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", ["owner", "manager"]);
  await rejectStockCountApproval(z.string().min(1).parse(countId), user.id);
  revalidatePath("/inventory/stock-count");
}

export async function postCountAction(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  await postCountAdjustments(z.string().min(1).parse(countId), user.id);
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
  const [storeWarehouses, allWarehouses, allStores, categories, products, flags] =
    await Promise.all([
      warehouseRepo.listWarehouses(storeId),
      warehouseRepo.listWarehouses(),
      storeRepo.listStores(),
      catalogRepo.listCategories(),
      catalogRepo.listProducts({ activeOnly: true }),
      getFeatureFlags(),
    ]);
  const stores = accessibleStores(allStores, user);
  const storeIds = new Set(stores.map((s) => s.id));
  const canApprove = user.role === "owner" || user.role === "manager";
  return {
    counts,
    activeCount: active,
    products,
    trackedProductCount: products.filter((p) => p.track_inventory).length,
    warehouses: storeWarehouses,
    printWarehouses: allWarehouses.filter((w) => storeIds.has(w.store_id) && w.is_active),
    stores,
    categories,
    storeId,
    canApprove,
    barcodeScannerEnabled: flags.barcode_scanner !== false,
  };
}

export async function getCountSheetPageData(params: {
  storeId?: string;
  warehouseId?: string;
  categoryId?: string;
  productId?: string;
}) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  const activeStoreId = await getValidatedActiveStoreId();
  const parsed = countSheetFiltersSchema.parse({
    storeId: params.storeId || undefined,
    warehouseId: params.warehouseId,
    categoryId: params.categoryId || undefined,
    productId: params.productId || undefined,
  });
  const storeId = parsed.storeId ?? activeStoreId;
  await requireStoreAccess(storeId);
  const sheet = await getCountSheet({
    storeId,
    warehouseId: parsed.warehouseId,
    filters: {
      categoryId: parsed.categoryId,
      productId: parsed.productId,
    },
    blankCounted: true,
  });
  return { sheet, generatedBy: user.name };
}

export async function getCountSessionPrintData(countId: string) {
  await requireFeature("stock_count");
  const user = await requirePermissionOrRole("stock_count_manage", [
    "owner",
    "manager",
    "inventory",
  ]);
  const sheet = await getCountSessionPrint(z.string().min(1).parse(countId));
  if (!sheet) return null;
  await requireStoreAccess(sheet.storeId);
  return { sheet, generatedBy: user.name };
}
