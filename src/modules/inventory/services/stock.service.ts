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

export async function listStockWithProducts(
  storeId: string,
  warehouseId?: string
): Promise<StockWithProduct[]> {
  const rawLevels = await inventoryRepo.listStockLevels(storeId, warehouseId);
  const levels = warehouseId
    ? rawLevels
    : Array.from(
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
  const products = await catalogRepo.listProducts();
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

export async function getLowStock(storeId: string, warehouseId?: string): Promise<StockLevelView[]> {
  const levels = await listStockWithProducts(storeId, warehouseId);
  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((p) => [p.id, p]));
  return levels
    .filter((l) => l.quantity <= l.reorder_point)
    .map((l) => ({
      ...l,
      product: productMap.get(l.product_id)!,
    }))
    .filter((l) => l.product?.track_inventory);
}

export async function groupStockByCategory(
  storeId: string,
  warehouseId?: string,
  productType?: ProductType
): Promise<StockCategoryGroup[]> {
  const [levels, categories, products] = await Promise.all([
    listStockWithProducts(storeId, warehouseId),
    catalogRepo.listCategories(),
    catalogRepo.listProducts(),
  ]);
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
