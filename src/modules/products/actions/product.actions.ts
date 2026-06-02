"use server";

import { revalidatePath } from "next/cache";
import { requireCatalogRead, requirePermissionOrRole } from "@/lib/auth/guards";
import type { CategoryInput, ProductInput } from "../services/product.service";
import * as productService from "../services/product.service";

export async function listProductsAction(
  options?: Parameters<typeof productService.listProducts>[0]
) {
  await requireCatalogRead();
  return productService.listProducts(options);
}

export async function listCategoriesAction() {
  await requireCatalogRead();
  return productService.listCategories();
}

export async function getProductAction(id: string) {
  await requireCatalogRead();
  return productService.getProduct(id);
}

export async function createProductAction(input: ProductInput) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const product = await productService.createProduct(input, user.id);
  revalidatePath("/products");
  return product;
}

export async function updateProductAction(id: string, input: Partial<ProductInput>) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const product = await productService.updateProduct(id, input, user.id);
  revalidatePath("/products");
  return product;
}

export async function deleteProductAction(id: string) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const ok = await productService.deleteProduct(id, user.id);
  revalidatePath("/products");
  return ok;
}

export async function createCategoryAction(input: CategoryInput) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const category = await productService.createCategory(input, user.id);
  revalidatePath("/products");
  return category;
}

export async function updateCategoryAction(id: string, input: Partial<CategoryInput>) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const category = await productService.updateCategory(id, input, user.id);
  revalidatePath("/products");
  return category;
}

export async function deleteCategoryAction(id: string) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const ok = await productService.deleteCategory(id, user.id);
  revalidatePath("/products");
  return ok;
}

import {
  getBusinessActivitySettings,
  getFeatureFlags,
  getProductTemplateSettings,
  getSouqnaIntegrationSettings,
} from "@/modules/system/services/settings.service";
import * as recipeService from "@/modules/products/services/recipe.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";

export async function getProductsPageDataAction() {
  await requireCatalogRead();
  const org = await import("@/lib/repositories/organization.repository").then(
    (m) => m.getOrganization()
  );
  const [
    rows,
    categories,
    featureFlags,
    recipeProductIds,
    souqnaSettings,
    productTemplates,
    businessActivitySettings,
  ] = await Promise.all([
    productService.getProductsWithCategories(),
    productService.listCategories(),
    getFeatureFlags(),
    recipeService.listProductIdsWithRecipes(),
    getSouqnaIntegrationSettings(),
    getProductTemplateSettings(),
    getBusinessActivitySettings(),
  ]);
  const variantMap = await catalogRepo.listVariantsForProducts(
    rows.map(({ product }) => product.id)
  );
  const recipeSet = new Set(recipeProductIds);
  return {
    organization: org,
    categories,
    recipesEnabled: featureFlags.recipes === true,
    souqnaEnabled: featureFlags.souqna_integration !== false,
    defaultPublishToSouqna: souqnaSettings.publish_products_to_souqna,
    productTemplates,
    businessActivitySettings,
    products: rows.map(({ product, category }) => ({
      product,
      category,
      hasRecipe: recipeSet.has(product.id),
      variantCount: (variantMap.get(product.id) ?? []).filter((v) => v.is_active).length,
    })),
  };
}
