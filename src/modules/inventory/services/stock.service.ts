import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import type { Category, Product, ProductType, StockLevel } from "@/lib/types";

export interface StockWithProduct extends StockLevel {
  productName: string;
  sku: string;
}

export interface StockLevelView extends StockLevel {
  product: Product;
}

export interface StockCategoryGroup {
  category: Category;
  items: StockLevelView[];
  totalQty: number;
  lowCount: number;
}

function aggregateLevelsAcrossWarehouses(rawLevels: StockLevel[]): StockLevel[] {
  return Array.from(
    rawLevels
      .reduce((map, level) => {
        const key = `${level.product_id}:${level.variant_id ?? ""}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...level, id: key, warehouse_id: "" });
        } else {
          existing.quantity += level.quantity;
          existing.reorder_point += level.reorder_point;
          if (level.updated_at > existing.updated_at) existing.updated_at = level.updated_at;
        }
        return map;
      }, new Map<string, StockLevel>())
      .values()
  );
}

export function resolveStockLevels(
  rawLevels: StockLevel[],
  warehouseId?: string
): StockLevel[] {
  return warehouseId ? rawLevels : aggregateLevelsAcrossWarehouses(rawLevels);
}

export function attachProductsToLevels(
  levels: StockLevel[],
  products: Product[]
): StockWithProduct[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return levels.map((level) => {
    const product = productMap.get(level.product_id);
    return {
      ...level,
      productName: product?.name ?? "Unknown",
      sku: product?.sku ?? "",
    };
  });
}

export function toLowStockViews(
  levels: StockWithProduct[],
  products: Product[]
): StockLevelView[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  return levels
    .filter((l) => l.quantity <= l.reorder_point)
    .map((l) => ({
      ...l,
      product: productMap.get(l.product_id)!,
    }))
    .filter((l) => l.product?.track_inventory);
}

export function buildStockCategoryGroups(
  levels: StockWithProduct[],
  categories: Category[],
  products: Product[],
  productType?: ProductType
): StockCategoryGroup[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const byCategory = new Map<string, StockLevelView[]>();

  for (const level of levels) {
    const product = productMap.get(level.product_id);
    if (!product) continue;
    if (productType && product.product_type !== productType) continue;
    const catId = product.category_id || "uncategorized";
    const view: StockLevelView = { ...level, product };
    const list = byCategory.get(catId) ?? [];
    list.push(view);
    byCategory.set(catId, list);
  }

  return categories
    .map((category) => {
      const items = byCategory.get(category.id) ?? [];
      return {
        category,
        items,
        totalQty: items.reduce((s, i) => s + i.quantity, 0),
        lowCount: items.filter((i) => i.quantity <= i.reorder_point).length,
      };
    })
    .filter((group) => group.items.length > 0);
}

export async function listStockWithProducts(
  storeId: string,
  warehouseId?: string,
  preloaded?: { levels?: StockLevel[]; products?: Product[] }
): Promise<StockWithProduct[]> {
  const [rawLevels, products] = await Promise.all([
    preloaded?.levels
      ? Promise.resolve(preloaded.levels)
      : inventoryRepo.listStockLevels(storeId, warehouseId),
    preloaded?.products
      ? Promise.resolve(preloaded.products)
      : catalogRepo.listProducts(),
  ]);
  return attachProductsToLevels(resolveStockLevels(rawLevels, warehouseId), products);
}

export async function getLowStock(
  storeId: string,
  warehouseId?: string,
  preloaded?: { levels?: StockLevel[]; products?: Product[] }
): Promise<StockLevelView[]> {
  const products =
    preloaded?.products ?? (await catalogRepo.listProducts());
  const levels = await listStockWithProducts(storeId, warehouseId, {
    levels: preloaded?.levels,
    products,
  });
  return toLowStockViews(levels, products);
}

/**
 * Low-stock rows for reorder / purchase drafts.
 * Keeps real `warehouse_id` — never aggregates across warehouses
 * (aggregation blanks warehouse_id and breaks draft creation).
 */
export async function getLowStockForReorder(
  storeId: string,
  warehouseId?: string,
  preloaded?: { levels?: StockLevel[]; products?: Product[] }
): Promise<StockLevelView[]> {
  const [rawLevels, products] = await Promise.all([
    preloaded?.levels
      ? Promise.resolve(preloaded.levels)
      : inventoryRepo.listStockLevels(storeId, warehouseId),
    preloaded?.products
      ? Promise.resolve(preloaded.products)
      : catalogRepo.listProducts(),
  ]);
  return toLowStockViews(attachProductsToLevels(rawLevels, products), products);
}

export async function groupStockByCategory(
  storeId: string,
  warehouseId?: string,
  productType?: ProductType,
  preloaded?: { levels?: StockLevel[]; products?: Product[]; categories?: Category[] }
): Promise<StockCategoryGroup[]> {
  const [rawLevels, categories, products] = await Promise.all([
    preloaded?.levels
      ? Promise.resolve(preloaded.levels)
      : inventoryRepo.listStockLevels(storeId, warehouseId),
    preloaded?.categories
      ? Promise.resolve(preloaded.categories)
      : catalogRepo.listCategories(),
    preloaded?.products
      ? Promise.resolve(preloaded.products)
      : catalogRepo.listProducts(),
  ]);
  const levels = attachProductsToLevels(resolveStockLevels(rawLevels, warehouseId), products);
  return buildStockCategoryGroups(levels, categories, products, productType);
}
