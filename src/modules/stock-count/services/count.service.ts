import * as countRepo from "@/lib/repositories/stock-count.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { roundMoney } from "@/lib/money";
import type { StockCount, StockCountLine, StockCountStatus } from "@/lib/types";
import { after } from "next/server";
import { filterTrackedProducts, qtyByProductIdFromLevels } from "@/modules/stock-count/lib/count-sheet";
import {
  openingCountedQty,
  shouldHealEmptyCountLines,
} from "@/modules/stock-count/lib/counted-qty";

export interface StockCountWithLines extends StockCount {
  lines: StockCountLine[];
}

export interface CountLineInput {
  productId: string;
  variantId?: string | null;
  countedQty: number;
  batchId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

/** Open counts that block starting another for the same warehouse. */
export const ACTIVE_STOCK_COUNT_STATUSES: StockCountStatus[] = [
  "in_progress",
  "pending_approval",
  "approved",
];

export function isActiveStockCountStatus(status: StockCountStatus): boolean {
  return ACTIVE_STOCK_COUNT_STATUSES.includes(status);
}

async function buildLinesForProducts(
  count: StockCount,
  products: Awaited<ReturnType<typeof catalogRepo.listProducts>>,
  countFromZero = false
): Promise<Omit<StockCountLine, "id">[]> {
  const levels = await inventoryRepo.listStockLevels(
    count.store_id,
    count.warehouse_id
  );
  const qtyByProductId = qtyByProductIdFromLevels(levels);
  return products.map((product) => {
    const expected = qtyByProductId.get(product.id) ?? 0;
    const opening = openingCountedQty(expected, countFromZero);
    return {
      count_id: count.id,
      product_id: product.id,
      variant_id: null,
      expected_qty: expected,
      counted_qty: opening.countedQty,
      variance: opening.variance,
    };
  });
}

/**
 * Heals empty in-progress counts (started before tracked products existed).
 * Does not add products to a scoped count that already has lines.
 */
export async function syncCountLines(count: StockCount): Promise<StockCountLine[]> {
  const existing = await countRepo.getStockCountLines(count.id);
  if (count.status !== "in_progress") return existing;
  if (!shouldHealEmptyCountLines(existing.length)) return existing;

  const tracked = (await catalogRepo.listProducts({ activeOnly: true })).filter(
    (p) => p.track_inventory
  );
  if (tracked.length === 0) return existing;

  await countRepo.insertStockCountLines(await buildLinesForProducts(count, tracked));
  return countRepo.getStockCountLines(count.id);
}

async function enrichCount(count: StockCount): Promise<StockCountWithLines> {
  const lines =
    count.status === "in_progress"
      ? await syncCountLines(count)
      : await countRepo.getStockCountLines(count.id);
  return { ...count, lines };
}

export async function listStockCounts(storeId?: string): Promise<StockCountWithLines[]> {
  const counts = await countRepo.listStockCounts(storeId);
  if (counts.length === 0) return [];
  const lines = await countRepo.getStockCountLinesForCounts(counts.map((c) => c.id));
  const linesByCount = new Map<string, StockCountLine[]>();
  for (const line of lines) {
    const list = linesByCount.get(line.count_id) ?? [];
    list.push(line);
    linesByCount.set(line.count_id, list);
  }
  return counts.map((count) => ({
    ...count,
    lines: linesByCount.get(count.id) ?? [],
  }));
}

export async function getStockCount(id: string): Promise<StockCountWithLines | null> {
  const count = await countRepo.getStockCount(id);
  if (!count) return null;
  return enrichCount(count);
}

export async function startStockCount(input: {
  storeId: string;
  warehouseId: string;
  createdBy: string;
  categoryId?: string;
  productId?: string;
  countFromZero?: boolean;
}): Promise<StockCountWithLines> {
  await assertPeriodOpen(input.storeId);
  const warehouse = await warehouseRepo.getWarehouse(input.warehouseId);
  if (!warehouse || warehouse.store_id !== input.storeId || !warehouse.is_active) {
    throw new Error("المخزن لا يتبع الفرع المحدد أو أنه غير نشط");
  }
  const counts = await countRepo.listStockCounts(input.storeId);
  const active = counts.find(
    (c) => isActiveStockCountStatus(c.status) && c.warehouse_id === input.warehouseId
  );
  if (active) return enrichCount(active);

  const allProducts = await catalogRepo.listProducts({ activeOnly: true });
  if (input.categoryId) {
    const categories = await catalogRepo.listCategories();
    if (!categories.some((category) => category.id === input.categoryId)) {
      throw new Error("قسم المنتجات غير موجود");
    }
  }
  if (input.productId && !allProducts.some((product) => product.id === input.productId)) {
    throw new Error("المنتج غير موجود");
  }

  const tracked = filterTrackedProducts(allProducts, {
    categoryId: input.categoryId,
    productId: input.productId,
  });
  if (tracked.length === 0) {
    throw new Error("مفيش أصناف بتتبع مخزون بالمعايير دي");
  }

  const countFromZero = input.countFromZero === true;
  const count = await countRepo.createStockCount({
    store_id: input.storeId,
    warehouse_id: input.warehouseId,
    status: "in_progress",
    created_by: input.createdBy,
  });

  await countRepo.insertStockCountLines(
    await buildLinesForProducts(count, tracked, countFromZero)
  );

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "stock_count.started",
    entityType: "stock_count",
    entityId: count.id,
    metadata: {
      warehouseId: input.warehouseId,
      categoryId: input.categoryId ?? null,
      productId: input.productId ?? null,
      countFromZero,
      lineCount: tracked.length,
    },
  });

  return enrichCount(count);
}

export async function submitCountLines(
  countId: string,
  lines: CountLineInput[]
): Promise<StockCountWithLines> {
  const count = await countRepo.getStockCount(countId);
  if (!count || count.status !== "in_progress") {
    throw new Error("لا يمكن تعديل الجرد إلا أثناء العد");
  }

  const existing = await countRepo.getStockCountLines(countId);
  for (const input of lines) {
    const line = existing.find(
      (l) =>
        l.product_id === input.productId &&
        l.variant_id === (input.variantId ?? null)
    );
    if (line) {
      const { getDb } = await import("@/lib/repositories/client");
      const db = await getDb();
      await db
        .from("stock_count_lines")
        .update({
          counted_qty: input.countedQty,
          variance: input.countedQty - line.expected_qty,
          batch_id: input.batchId ?? null,
          batch_number: input.batchNumber ?? null,
          expiry_date: input.expiryDate ?? null,
        })
        .eq("id", line.id);
    }
  }

  return enrichCount(count);
}

/** After counting: lock lines and wait for owner/manager approval before posting. */
export async function submitCountForApproval(
  countId: string,
  userId: string
): Promise<StockCount> {
  const count = await countRepo.getStockCount(countId);
  if (!count || count.status !== "in_progress") {
    throw new Error("الجرد غير جاهز للإرسال للاعتماد");
  }
  await assertPeriodOpen(count.store_id);

  const updated = await countRepo.updateStockCount(countId, {
    status: "pending_approval",
  });
  if (!updated) throw new Error("تعذر إرسال الجرد للاعتماد");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: count.store_id,
    userId,
    action: "stock_count.submitted_for_approval",
    entityType: "stock_count",
    entityId: countId,
  });

  return updated;
}

/** Owner/manager approval gate — required before posting adjustments. */
export async function approveStockCount(
  countId: string,
  userId: string
): Promise<StockCount> {
  const count = await countRepo.getStockCount(countId);
  if (!count) throw new Error("الجرد غير موجود");
  if (count.status === "approved") return count;
  if (count.status !== "pending_approval") {
    throw new Error("الجرد ليس بانتظار الاعتماد");
  }
  await assertPeriodOpen(count.store_id);

  const updated = await countRepo.updateStockCount(countId, {
    status: "approved",
  });
  if (!updated) throw new Error("تعذر اعتماد الجرد");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: count.store_id,
    userId,
    action: "stock_count.approved",
    entityType: "stock_count",
    entityId: countId,
  });

  return updated;
}

/** Return count to in_progress so lines can be corrected after rejection. */
export async function rejectStockCountApproval(
  countId: string,
  userId: string
): Promise<StockCount> {
  const count = await countRepo.getStockCount(countId);
  if (!count || (count.status !== "pending_approval" && count.status !== "approved")) {
    throw new Error("لا يمكن إرجاع هذا الجرد للعد");
  }
  await assertPeriodOpen(count.store_id);

  const updated = await countRepo.updateStockCount(countId, {
    status: "in_progress",
  });
  if (!updated) throw new Error("تعذر إرجاع الجرد");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: count.store_id,
    userId,
    action: "stock_count.approval_rejected",
    entityType: "stock_count",
    entityId: countId,
    metadata: { previousStatus: count.status },
  });

  return updated;
}

export async function postCountAdjustments(
  countId: string,
  userId: string
): Promise<StockCount> {
  const count = await countRepo.getStockCount(countId);
  if (!count) throw new Error("الجرد غير موجود");
  if (count.status === "completed") throw new Error("الجرد مكتمل مسبقاً");
  if (count.status !== "approved") {
    throw new Error("لا يمكن ترحيل الفروقات قبل اعتماد الجرد");
  }
  await assertPeriodOpen(count.store_id);

  const lines = await countRepo.getStockCountLines(countId);
  for (const line of lines) {
    if (line.variance === 0) continue;
    await adjustStock({
      storeId: count.store_id,
      warehouseId: count.warehouse_id,
      productId: line.product_id,
      variantId: line.variant_id,
      quantityDelta: line.variance,
      movementType: "stock_count",
      referenceType: "stock_count",
      referenceId: countId,
      reason: `Count variance: ${line.variance > 0 ? "+" : ""}${line.variance}`,
      createdBy: userId,
      batch: {
        batchNumber: line.batch_number ?? null,
        expiryDate: line.expiry_date ?? null,
        sourceType: "adjustment",
        sourceDocumentId: countId,
      },
    });
  }

  const productIds = [...new Set(lines.map((line) => line.product_id))];
  const products = await catalogRepo.getProductsByIds(productIds);
  const inventoryDeltaValue = roundMoney(
    lines.reduce((sum, line) => {
      if (line.variance === 0) return sum;
      const unitCost = Math.max(0, products.get(line.product_id)?.last_unit_cost ?? 0);
      return sum + line.variance * unitCost;
    }, 0)
  );

  const updated = await countRepo.updateStockCount(countId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("Failed to complete count");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: count.store_id,
    userId,
    action: "stock_count.completed",
    entityType: "stock_count",
    entityId: countId,
    metadata: {
      adjustedLines: lines.filter((l) => l.variance !== 0).length,
      inventoryDeltaValue,
    },
  });

  after(() => {
    void (async () => {
      try {
        const { safePostStockCountJournal } = await import(
          "@/modules/accounting/services/gl-posting.service"
        );
        await safePostStockCountJournal({
          countId,
          storeId: count.store_id,
          inventoryDeltaValue,
          createdBy: userId,
          memo: `فروقات جرد`,
        });
      } catch (error) {
        console.error("[stock-count] deferred GL post failed", error);
      }
    })();
  });

  return updated;
}
