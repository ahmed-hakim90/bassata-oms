import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import {
  buildCountSheetLines,
  groupCountSheetLines,
  countSheetTotals,
  qtyByProductIdFromLevels,
  type CountSheetFilters,
  type CountSheetGroup,
  type CountSheetLine,
} from "@/modules/stock-count/lib/count-sheet";
import { getStockCount } from "@/modules/stock-count/services/count.service";

export interface StockCountSheetResult {
  storeId: string;
  storeName: string;
  warehouseName: string;
  categoryName: string | null;
  productName: string | null;
  blankCounted: boolean;
  truncated: boolean;
  lines: CountSheetLine[];
  groups: CountSheetGroup[];
  totals: ReturnType<typeof countSheetTotals>;
}

export async function getCountSheet(input: {
  storeId: string;
  warehouseId: string;
  filters: CountSheetFilters;
  blankCounted: boolean;
}): Promise<StockCountSheetResult> {
  const warehouse = await warehouseRepo.getWarehouse(input.warehouseId);
  if (!warehouse || warehouse.store_id !== input.storeId || !warehouse.is_active) {
    throw new Error("المخزن لا يتبع الفرع المحدد أو أنه غير نشط");
  }

  const [store, products, categories, levels] = await Promise.all([
    storeRepo.getStore(input.storeId),
    catalogRepo.listProducts({ activeOnly: true }),
    catalogRepo.listCategories(),
    inventoryRepo.listStockLevels(input.storeId, input.warehouseId),
  ]);
  if (!store) throw new Error("الفرع غير موجود");

  if (input.filters.categoryId) {
    const category = categories.find((c) => c.id === input.filters.categoryId);
    if (!category) throw new Error("قسم المنتجات غير موجود");
  }
  if (input.filters.productId) {
    const product = products.find((p) => p.id === input.filters.productId);
    if (!product) throw new Error("المنتج غير موجود");
  }

  const { lines, truncated } = buildCountSheetLines({
    products,
    categories,
    qtyByProductId: qtyByProductIdFromLevels(levels),
    filters: input.filters,
    blankCounted: input.blankCounted,
  });

  const categoryName = input.filters.categoryId
    ? (categories.find((c) => c.id === input.filters.categoryId)?.name ?? null)
    : null;
  const productName = input.filters.productId
    ? (products.find((p) => p.id === input.filters.productId)?.name ?? null)
    : null;

  return {
    storeId: store.id,
    storeName: store.name,
    warehouseName: warehouse.name,
    categoryName,
    productName,
    blankCounted: input.blankCounted,
    truncated,
    lines,
    groups: groupCountSheetLines(lines),
    totals: countSheetTotals(lines),
  };
}

export async function getCountSessionPrint(countId: string): Promise<
  | (StockCountSheetResult & { countId: string; startedAt: string; status: string })
  | null
> {
  const count = await getStockCount(countId);
  if (!count) return null;

  const [warehouse, store, products, categories] = await Promise.all([
    warehouseRepo.getWarehouse(count.warehouse_id),
    storeRepo.getStore(count.store_id),
    catalogRepo.listProducts(),
    catalogRepo.listCategories(),
  ]);

  const countedByProductId = new Map(
    count.lines.map((line) => [line.product_id, line.counted_qty])
  );
  const qtyByProductId = new Map(
    count.lines.map((line) => [line.product_id, line.expected_qty])
  );
  const productIds = new Set(count.lines.map((line) => line.product_id));
  const sessionProducts = products.filter((p) => productIds.has(p.id));

  const { lines, truncated } = buildCountSheetLines({
    products: sessionProducts,
    categories,
    qtyByProductId,
    countedByProductId,
    filters: {},
    blankCounted: false,
    trackedOnly: false,
  });

  return {
    countId: count.id,
    startedAt: count.started_at,
    status: count.status,
    storeId: count.store_id,
    storeName: store?.name ?? "فرع",
    warehouseName: warehouse?.name ?? "مخزن",
    categoryName: null,
    productName: null,
    blankCounted: false,
    truncated,
    lines,
    groups: groupCountSheetLines(lines),
    totals: countSheetTotals(lines),
  };
}
