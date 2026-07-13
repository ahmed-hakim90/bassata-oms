import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { formatUnit } from "@/lib/units";
import type { MeasurementUnit, MovementType, Product } from "@/lib/types";
import {
  classifyStockCardMovement,
  STOCK_CARD_BUCKET_LABELS_AR,
  STOCK_CARD_TYPE_LABELS_AR,
  type StockCardBucket,
} from "@/modules/reports/lib/product-stock-buckets";

export interface ProductStockCardLine {
  id: string;
  at: string;
  movementType: MovementType;
  movementTypeLabel: string;
  bucket: StockCardBucket;
  bucketLabel: string;
  quantityDelta: number;
  inQty: number;
  outQty: number;
  equalizeQty: number;
  balance: number;
  warehouseId: string;
  warehouseName: string;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
}

export interface ProductStockCardReport {
  product: {
    id: string;
    name: string;
    sku: string;
    unit: MeasurementUnit;
    unitLabel: string;
  };
  storeId: string;
  warehouseId: string | null;
  warehouseName: string | null;
  fromIso: string;
  toIso: string;
  openingQty: number;
  closingQty: number;
  /** Current on-hand from stock_levels (available physical). */
  onHandQty: number;
  totals: {
    inQty: number;
    outQty: number;
    equalizeQty: number;
    equalizeInQty: number;
    equalizeOutQty: number;
    lineCount: number;
  };
  lines: ProductStockCardLine[];
}

function roundQty(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export async function getProductStockCard(options: {
  storeId: string;
  productId: string;
  from: Date;
  to: Date;
  warehouseId?: string;
}): Promise<ProductStockCardReport | null> {
  const product = await catalogRepo.getProduct(options.productId);
  if (!product) return null;

  const fromIso = options.from.toISOString();
  const toIso = options.to.toISOString();

  const [movements, warehouses, stockLevels] = await Promise.all([
    inventoryRepo.listAllMovementsForProduct({
      storeId: options.storeId,
      productId: options.productId,
      warehouseId: options.warehouseId,
      to: toIso,
    }),
    warehouseRepo.listWarehouses(options.storeId),
    inventoryRepo.listStockLevels(options.storeId, options.warehouseId),
  ]);

  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const warehouseName = options.warehouseId
    ? (warehouseMap.get(options.warehouseId) ?? null)
    : null;

  let openingQty = 0;
  for (const m of movements) {
    if (m.created_at < fromIso) {
      openingQty += m.quantity_delta;
    }
  }
  openingQty = roundQty(openingQty);

  const periodMovements = movements.filter(
    (m) => m.created_at >= fromIso && m.created_at <= toIso
  );

  let running = openingQty;
  let inQty = 0;
  let outQty = 0;
  let equalizeQty = 0;
  let equalizeInQty = 0;
  let equalizeOutQty = 0;

  const lines: ProductStockCardLine[] = periodMovements.map((m) => {
    const bucket = classifyStockCardMovement(m.movement_type, m.quantity_delta);
    const delta = m.quantity_delta;
    running = roundQty(running + delta);

    let lineIn = 0;
    let lineOut = 0;
    let lineEq = 0;
    if (bucket === "in") {
      lineIn = Math.abs(delta);
      inQty += lineIn;
    } else if (bucket === "out") {
      lineOut = Math.abs(delta);
      outQty += lineOut;
    } else {
      lineEq = delta;
      equalizeQty += delta;
      if (delta >= 0) equalizeInQty += delta;
      else equalizeOutQty += Math.abs(delta);
    }

    return {
      id: m.id,
      at: m.created_at,
      movementType: m.movement_type,
      movementTypeLabel: STOCK_CARD_TYPE_LABELS_AR[m.movement_type] ?? m.movement_type,
      bucket,
      bucketLabel: STOCK_CARD_BUCKET_LABELS_AR[bucket],
      quantityDelta: delta,
      inQty: roundQty(lineIn),
      outQty: roundQty(lineOut),
      equalizeQty: roundQty(lineEq),
      balance: running,
      warehouseId: m.warehouse_id,
      warehouseName: warehouseMap.get(m.warehouse_id) ?? "—",
      reason: m.reason,
      referenceType: m.reference_type,
      referenceId: m.reference_id,
    };
  });

  const onHandQty = roundQty(
    stockLevels
      .filter((s) => s.product_id === options.productId)
      .reduce((sum, s) => sum + s.quantity, 0)
  );

  return {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      unitLabel: formatUnit(product.unit),
    },
    storeId: options.storeId,
    warehouseId: options.warehouseId ?? null,
    warehouseName,
    fromIso,
    toIso,
    openingQty,
    closingQty: running,
    onHandQty,
    totals: {
      inQty: roundQty(inQty),
      outQty: roundQty(outQty),
      equalizeQty: roundQty(equalizeQty),
      equalizeInQty: roundQty(equalizeInQty),
      equalizeOutQty: roundQty(equalizeOutQty),
      lineCount: lines.length,
    },
    lines,
  };
}

export function productOptionsForStockCard(products: Product[]): Product[] {
  return products
    .filter((p) => p.track_inventory && p.is_active)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}
