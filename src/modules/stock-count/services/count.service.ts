import * as countRepo from "@/lib/repositories/stock-count.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock, getStockLevel } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import type { StockCount, StockCountLine } from "@/lib/types";

export interface StockCountWithLines extends StockCount {
  lines: StockCountLine[];
}

export interface CountLineInput {
  productId: string;
  variantId?: string | null;
  countedQty: number;
}

async function enrichCount(count: StockCount): Promise<StockCountWithLines> {
  const lines = await countRepo.getStockCountLines(count.id);
  return { ...count, lines };
}

export async function listStockCounts(storeId?: string): Promise<StockCountWithLines[]> {
  const counts = await countRepo.listStockCounts(storeId);
  return Promise.all(counts.map(enrichCount));
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
}): Promise<StockCountWithLines> {
  await assertPeriodOpen(input.storeId);
  const counts = await countRepo.listStockCounts(input.storeId);
  const active = counts.find(
    (c) => c.status === "in_progress" && c.warehouse_id === input.warehouseId
  );
  if (active) return enrichCount(active);

  const count = await countRepo.createStockCount({
    store_id: input.storeId,
    warehouse_id: input.warehouseId,
    status: "in_progress",
    created_by: input.createdBy,
  });

  const products = await catalogRepo.listProducts({ activeOnly: true });
  const lines: Omit<StockCountLine, "id">[] = [];
  for (const product of products.filter((p) => p.track_inventory)) {
    const expected = await getStockLevel(input.storeId, input.warehouseId, product.id, null);
    lines.push({
      count_id: count.id,
      product_id: product.id,
      variant_id: null,
      expected_qty: expected,
      counted_qty: expected,
      variance: 0,
    });
  }
  await countRepo.insertStockCountLines(lines);

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "stock_count.started",
    entityType: "stock_count",
    entityId: count.id,
    metadata: { warehouseId: input.warehouseId },
  });

  return enrichCount(count);
}

export async function submitCountLines(
  countId: string,
  lines: CountLineInput[]
): Promise<StockCountWithLines> {
  const count = await countRepo.getStockCount(countId);
  if (!count || count.status !== "in_progress") throw new Error("Count not in progress");

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
        })
        .eq("id", line.id);
    }
  }

  return enrichCount(count);
}

export async function postCountAdjustments(
  countId: string,
  userId: string
): Promise<StockCount> {
  const count = await countRepo.getStockCount(countId);
  if (!count || count.status !== "in_progress") throw new Error("Count not in progress");
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
    });
  }

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
    metadata: { adjustedLines: lines.filter((l) => l.variance !== 0).length },
  });

  return updated;
}
