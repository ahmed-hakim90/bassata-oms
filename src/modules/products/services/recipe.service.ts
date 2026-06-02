import * as recipeRepo from "@/lib/repositories/recipe.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { convertUnit } from "@/lib/units";
import type { MeasurementUnit, ProductRecipeLineWithProduct } from "@/lib/types";

export async function getRecipeForProduct(productId: string, variantId?: string | null) {
  return recipeRepo.getRecipeWithLines(productId, variantId);
}

export async function saveRecipe(
  productId: string,
  lines: { ingredient_product_id: string; quantity: number; unit: MeasurementUnit }[],
  userId: string,
  variantId?: string | null
) {
  const product = await catalogRepo.getProduct(productId);
  if (!product) throw new Error("Product not found");
  if (product.product_type !== "finished") {
    throw new Error("Only finished products can have recipes");
  }

  for (const line of lines) {
    const ing = await catalogRepo.getProduct(line.ingredient_product_id);
    if (!ing || ing.product_type !== "ingredient") {
      throw new Error("Recipe lines must reference ingredient products");
    }
  }

  const recipe = await recipeRepo.upsertRecipe(productId, lines, variantId);

  if (lines.length > 0 && !variantId) {
    await catalogRepo.updateProduct(productId, { track_inventory: false });
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "recipe.saved",
    entityType: "product",
    entityId: productId,
    metadata: { lineCount: lines.length, variantId: variantId ?? null },
  });

  return recipe;
}

export async function deleteRecipe(
  productId: string,
  userId: string,
  variantId?: string | null
) {
  await recipeRepo.deleteRecipe(productId, variantId);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "recipe.deleted",
    entityType: "product",
    entityId: productId,
    metadata: { variantId: variantId ?? null },
  });
}

export function computeRecipeSummary(
  lines: ProductRecipeLineWithProduct[],
  salePrice: number
) {
  const recipeCost = recipeRepo.computeRecipeTotalCost(lines);
  const profit = salePrice - recipeCost;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
  return { recipeCost, profit, margin };
}

export async function computeMakeableQty(
  productId: string,
  storeId: string,
  variantId?: string | null
): Promise<number | null> {
  const recipeData = await recipeRepo.getRecipeWithLines(productId, variantId);
  if (!recipeData || recipeData.lines.length === 0) return null;

  const warehouse = await warehouseRepo.getDefaultWarehouse(storeId);
  if (!warehouse) return 0;

  const levels = await inventoryRepo.listStockLevels(storeId, warehouse.id);
  const levelMap = new Map(levels.filter((l) => !l.variant_id).map((l) => [l.product_id, l]));

  const ingredientProducts = await catalogRepo.listProducts({ productType: "ingredient" });
  const ingredientUnitMap = new Map(ingredientProducts.map((p) => [p.id, p.unit]));

  const makeable = recipeData.lines.map((line) => {
    const stockUnit = ingredientUnitMap.get(line.ingredient_product_id) ?? "piece";
    const level = levelMap.get(line.ingredient_product_id);
    const stockQty = level?.quantity ?? 0;
    const neededPerUnit = convertUnit(line.quantity, line.unit, stockUnit);
    if (neededPerUnit <= 0) return 0;
    return Math.floor(stockQty / neededPerUnit);
  });

  return Math.min(...makeable);
}

export async function listIngredients() {
  return catalogRepo.listProducts({ productType: "ingredient" });
}

export async function listProductIdsWithRecipes() {
  return recipeRepo.listProductIdsWithRecipes();
}
