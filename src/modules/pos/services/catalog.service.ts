import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";
import { convertUnit } from "@/lib/units";
import { resolveVariantPrice } from "@/modules/products/services/variant.service";
import {
  canProductBeRecipeIngredient,
  canProductHaveRecipe,
} from "@/modules/products/services/recipe.service";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import type { Category, Product, StockLevel } from "@/lib/types";

export type StockBadge = "in_stock" | "low" | "out" | "untracked";

export interface POSVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  imageUrl: string | null;
  stockQuantity: number | null;
  stockBadge: StockBadge;
  hasRecipe: boolean;
}

export interface POSProduct extends Product {
  stockQuantity: number | null;
  stockBadge: StockBadge;
  categoryName: string;
  categoryColor: string;
  hasRecipe: boolean;
  hasVariants: boolean;
  variants: POSVariant[];
}

function computeStockBadge(
  quantity: number | null,
  reorderPoint = 10
): StockBadge {
  if (quantity == null) return "untracked";
  if (quantity <= 0) return "out";
  if (quantity <= reorderPoint) return "low";
  return "in_stock";
}

function computeMakeableFromLines(
  lines: Awaited<ReturnType<typeof recipeRepo.getRecipeLines>>,
  levelMap: Map<string, { quantity: number; reorder_point: number }>,
  ingredientUnitMap: Map<string, string>
): { qty: number; badge: StockBadge } {
  if (lines.length === 0) return { qty: 0, badge: "out" };

  const makeable = lines.map((line) => {
    const stockUnit = ingredientUnitMap.get(line.ingredient_product_id) ?? "piece";
    const level = levelMap.get(line.ingredient_product_id);
    const stockQty = level?.quantity ?? 0;
    const neededPerUnit = convertUnit(
      line.quantity,
      line.unit as Parameters<typeof convertUnit>[1],
      stockUnit as Parameters<typeof convertUnit>[2]
    );
    if (neededPerUnit <= 0) return 0;
    return Math.floor(stockQty / neededPerUnit);
  });

  const qty = Math.min(...makeable);
  return { qty, badge: computeStockBadge(qty, 5) };
}

function emptyLevelMaps(): {
  baseLevelMap: Map<string, StockLevel>;
  variantLevelMap: Map<string, StockLevel>;
} {
  return {
    baseLevelMap: new Map(),
    variantLevelMap: new Map(),
  };
}

function buildLevelMaps(levels: StockLevel[]) {
  return {
    baseLevelMap: new Map(
      levels.filter((l) => !l.variant_id).map((l) => [l.product_id, l])
    ),
    variantLevelMap: new Map(
      levels
        .filter((l) => l.variant_id)
        .map((l) => [`${l.product_id}:${l.variant_id}`, l])
    ),
  };
}

export async function getProductsForPOS(
  storeId: string,
  categoryId?: string
): Promise<POSProduct[]> {
  const defaultWarehouse = await warehouseRepo.getDefaultWarehouse(storeId);
  if (!defaultWarehouse) throw new Error("Default warehouse not found");

  const [categories, flags, recipeKeys, productsRaw] = await Promise.all([
    catalogRepo.listCategories(),
    getFeatureFlags(),
    recipeRepo.listRecipeKeys(),
    catalogRepo.listProducts({
      categoryId,
      activeOnly: true,
    }),
  ]);

  const products = productsRaw.filter(canProductHaveRecipe);
  const recipesEnabled = flags.recipes === true;
  const recipeProductSet = new Set(recipeKeys.map((k) => k.productId));
  const recipeByKey = new Map(
    recipeKeys.map((k) => [`${k.productId}:${k.variantId ?? ""}`, k])
  );

  const anyTracked = products.some((p) => p.track_inventory);
  const anyRecipeOnCatalog =
    recipesEnabled && products.some((p) => recipeProductSet.has(p.id));
  const needsStock = anyTracked || anyRecipeOnCatalog;

  const [variantMap, levels, recipeLinesCache, ingredientUnitMap] = await Promise.all([
    catalogRepo.listVariantsForProducts(products.map((p) => p.id)),
    needsStock
      ? inventoryRepo.listStockLevels(storeId, defaultWarehouse.id)
      : Promise.resolve([] as StockLevel[]),
    anyRecipeOnCatalog
      ? recipeRepo.listAllRecipeLinesByProductKey()
      : Promise.resolve(new Map<string, Awaited<ReturnType<typeof recipeRepo.getRecipeLines>>>()),
    anyRecipeOnCatalog
      ? catalogRepo.listProducts().then((all) => {
          const ingredients = all.filter(canProductBeRecipeIngredient);
          return new Map(ingredients.map((p) => [p.id, p.unit]));
        })
      : Promise.resolve(new Map<string, string>()),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const { baseLevelMap, variantLevelMap } = needsStock
    ? buildLevelMaps(levels)
    : emptyLevelMaps();
  const ingredientLevelMap = baseLevelMap;

  return products.map((product) => {
    const cat = categoryMap.get(product.category_id);
    const rawVariants = (variantMap.get(product.id) ?? []).filter((v) => v.is_active);
    const hasVariants = rawVariants.length > 0;

    const posVariants: POSVariant[] = rawVariants.map((variant) => {
      const key = `${product.id}:${variant.id}`;
      const hasVariantRecipe = recipesEnabled && recipeByKey.has(key);
      const hasProductRecipe =
        recipesEnabled && recipeByKey.has(`${product.id}:`) && !hasVariantRecipe;
      const hasRecipe = hasVariantRecipe || hasProductRecipe;

      let stockQuantity: number | null = null;
      let stockBadge: StockBadge = "untracked";

      const recipeKey = hasVariantRecipe ? key : `${product.id}:`;
      const lines = recipeLinesCache.get(recipeKey) ?? [];

      if (hasRecipe && lines.length > 0) {
        const result = computeMakeableFromLines(
          lines,
          ingredientLevelMap as Map<string, { quantity: number; reorder_point: number }>,
          ingredientUnitMap
        );
        stockQuantity = result.qty;
        stockBadge = result.badge;
      } else if (product.track_inventory) {
        const level = variantLevelMap.get(`${product.id}:${variant.id}`);
        if (level) {
          stockQuantity = level.quantity;
          stockBadge = computeStockBadge(level.quantity, level.reorder_point);
        }
      }

      return {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        price: resolveVariantPrice(product.base_price, variant),
        imageUrl: variant.image_url,
        stockQuantity,
        stockBadge,
        hasRecipe,
      };
    });

    const hasRecipe = recipesEnabled && recipeProductSet.has(product.id);
    let stockQuantity: number | null = null;
    let stockBadge: StockBadge = "untracked";

    if (hasVariants) {
      stockBadge = "untracked";
    } else if (hasRecipe) {
      const lines = recipeLinesCache.get(`${product.id}:`) ?? [];
      if (lines.length === 0) {
        stockBadge = "out";
        stockQuantity = 0;
      } else {
        const result = computeMakeableFromLines(
          lines,
          ingredientLevelMap as Map<string, { quantity: number; reorder_point: number }>,
          ingredientUnitMap
        );
        stockQuantity = result.qty;
        stockBadge = result.badge;
      }
    } else if (product.track_inventory) {
      const level = baseLevelMap.get(product.id);
      if (level) {
        stockQuantity = level.quantity;
        stockBadge = computeStockBadge(level.quantity, level.reorder_point);
      }
    }

    return {
      ...product,
      stockQuantity,
      stockBadge,
      categoryName: cat?.name ?? "Other",
      categoryColor: cat?.color ?? "#94A3B8",
      hasRecipe,
      hasVariants,
      variants: posVariants,
    };
  });
}

export async function getCategoriesForPOS(): Promise<Category[]> {
  return catalogRepo.listCategories();
}
