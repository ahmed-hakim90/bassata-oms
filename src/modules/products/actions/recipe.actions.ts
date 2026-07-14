"use server";

import { requireCatalogRead, requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import * as recipeService from "@/modules/products/services/recipe.service";

export async function getRecipeAction(productId: string, variantId?: string | null) {
  await requireCatalogRead();
  return recipeService.getRecipeForProduct(productId, variantId);
}

export async function listIngredientsAction() {
  await requireCatalogRead();
  return recipeService.listIngredients();
}

export async function saveRecipeAction(
  productId: string,
  ingredients: Parameters<typeof recipeService.saveRecipe>[1],
  variantId?: string | null
) {
  await requireFeature("recipes");
  const user = await requirePermissionOrRole("recipe_manage", ["owner", "manager"]);
  // Skip revalidatePath — keep product dialog open without remounting the page.
  return recipeService.saveRecipe(productId, ingredients, user.id, variantId);
}

export async function deleteRecipeAction(productId: string, variantId?: string | null) {
  await requireFeature("recipes");
  const user = await requirePermissionOrRole("recipe_manage", ["owner", "manager"]);
  await recipeService.deleteRecipe(productId, user.id, variantId);
}
