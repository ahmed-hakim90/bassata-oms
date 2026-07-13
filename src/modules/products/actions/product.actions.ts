"use server";

import { revalidatePath } from "next/cache";
import { requireCatalogRead, requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { getDb } from "@/lib/repositories/client";
import { writeAuditLog } from "@/lib/services/audit.service";
import type { MeasurementUnit } from "@/lib/types";
import type { CategoryInput, ProductInput } from "../services/product.service";
import * as productService from "../services/product.service";
import * as variantService from "../services/variant.service";

const PRODUCT_IMAGE_BUCKET = "org-assets";
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

export async function bulkDisableMenuInventoryTrackingAction() {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const orgId = await getOrgId();
  const db = await getDb();

  const { data: products, error } = await db
    .from("products")
    .update({
      is_active: true,
      track_inventory: false,
      inventory_tracking_mode: "none",
      expiry_tracking_enabled: false,
    })
    .eq("org_id", orgId)
    .eq("product_type", "finished")
    .select("id");

  if (error) throw new Error(error.message);

  const productIds = (products ?? []).map((product) => product.id);
  if (productIds.length > 0) {
    const { error: variantsError } = await db
      .from("product_variants")
      .update({ is_active: true })
      .in("product_id", productIds);
    if (variantsError) throw new Error(variantsError.message);
  }

  await writeAuditLog({
    orgId,
    userId: user.id,
    action: "product.bulk_untracked",
    entityType: "product",
    entityId: orgId,
    metadata: { count: productIds.length },
  });

  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/menu", "layout");
  return { count: productIds.length };
}

export async function uploadProductImageAction(productId: string, formData: FormData) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const product = await productService.getProduct(productId);
  if (!product) throw new Error("المنتج غير موجود");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("صورة المنتج مطلوبة.");
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("حجم صورة المنتج يجب ألا يتجاوز 5 ميجابايت.");
  }

  const ext = PRODUCT_IMAGE_EXTENSIONS[file.type];
  if (!ext) {
    throw new Error("صورة المنتج يجب أن تكون JPEG أو PNG أو WebP أو GIF.");
  }

  const orgId = await getOrgId();
  const path = `${orgId}/public/products/${productId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { getDb } = await import("@/lib/repositories/client");
  const db = await getDb();
  const { error: uploadError } = await db.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = db.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);

  await productService.updateProduct(productId, { image_url: publicUrl }, user.id);
  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/menu", "layout");
  return publicUrl;
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
  revalidatePath("/menu", "layout");
  return category;
}

export async function updateCategoryAction(id: string, input: Partial<CategoryInput>) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const category = await productService.updateCategory(id, input, user.id);
  revalidatePath("/products");
  revalidatePath("/menu", "layout");
  return category;
}

export async function deleteCategoryAction(id: string) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const ok = await productService.deleteCategory(id, user.id);
  revalidatePath("/products");
  revalidatePath("/menu", "layout");
  return ok;
}

export type CafeMenuItemInput = {
  productId?: string;
  name: string;
  category_id: string;
  sale_price?: number;
  sku?: string;
  barcode?: string;
  description?: string;
  image_url?: string | null;
  is_active?: boolean;
  is_popular?: boolean;
  ingredients: {
    ingredient_product_id: string;
    quantity: number;
    unit: MeasurementUnit;
  }[];
  variants?: {
    name: string;
    sku?: string;
    barcode?: string;
    price: number;
    ingredients: {
      ingredient_product_id: string;
      quantity: number;
      unit: MeasurementUnit;
    }[];
  }[];
};

export type CafeIngredientInput = {
  name: string;
  category_id: string;
  unit: MeasurementUnit;
  unit_cost: number;
};

function buildCafeMenuProductInput(input: CafeMenuItemInput): ProductInput {
  const sku = input.sku?.trim() ?? "";
  const barcode = input.barcode?.trim() || sku;
  return {
    name: input.name.trim(),
    sku,
    barcode,
    image_url: input.image_url ?? null,
    category_id: input.category_id,
    base_price: input.sale_price ?? 0,
    description: input.description?.trim() ?? "",
    sale_price: null,
    is_active: input.is_active ?? true,
    is_popular: input.is_popular ?? false,
    show_on_online_menu: true,
    track_inventory: false,
    product_type: "finished",
    inventory_tracking_mode: "none",
    inventory_rotation_method: "FIFO",
    expiry_policy: "warn_only",
    expiry_tracking_enabled: false,
    shelf_life_value: 0,
    shelf_life_unit: "days",
    unit: "piece",
    sale_unit: "piece",
    base_unit: "piece",
    sales_unit_type: "piece",
    allow_fractional_quantity: false,
    allow_price_input: false,
    wholesale_enabled: false,
    last_unit_cost: 0,
    cost_unit: "piece",
  };
}

function salesUnitTypeForUnit(unit: MeasurementUnit): ProductInput["sales_unit_type"] {
  if (unit === "kg" || unit === "gram") return "weight";
  if (unit === "liter" || unit === "ml") return "volume";
  return "piece";
}

function buildCafeIngredientProductInput(input: CafeIngredientInput): ProductInput {
  const unitCost = Math.max(0, Number(input.unit_cost) || 0);
  return {
    name: input.name.trim(),
    sku: "",
    barcode: "",
    image_url: null,
    category_id: input.category_id,
    base_price: 0,
    description: "",
    sale_price: null,
    is_active: true,
    is_popular: false,
    show_on_online_menu: false,
    track_inventory: true,
    product_type: "ingredient",
    inventory_tracking_mode: "standard",
    inventory_rotation_method: "FIFO",
    expiry_policy: "warn_only",
    expiry_tracking_enabled: false,
    shelf_life_value: 0,
    shelf_life_unit: "days",
    unit: input.unit,
    sale_unit: input.unit,
    base_unit: input.unit,
    sales_unit_type: salesUnitTypeForUnit(input.unit),
    allow_fractional_quantity: input.unit !== "piece",
    allow_price_input: false,
    wholesale_enabled: false,
    last_unit_cost: unitCost,
    cost_unit: input.unit,
  };
}

export async function createCafeIngredientAction(input: CafeIngredientInput) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  if (!input.name.trim()) {
    throw new Error("Ingredient name is required");
  }
  if (!input.category_id) {
    throw new Error("Ingredient category is required");
  }

  const ingredient = await productService.createProduct(
    buildCafeIngredientProductInput(input),
    user.id
  );
  revalidatePath("/products");
  revalidatePath("/inventory");
  return ingredient;
}

export async function updateCafeIngredientAction(productId: string, input: CafeIngredientInput) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  if (!input.name.trim()) {
    throw new Error("Ingredient name is required");
  }
  if (!input.category_id) {
    throw new Error("Ingredient category is required");
  }

  const unitCost = Math.max(0, Number(input.unit_cost) || 0);
  const ingredient = await productService.updateProduct(
    productId,
    {
      name: input.name.trim(),
      category_id: input.category_id,
      base_price: 0,
      sale_price: null,
      track_inventory: true,
      product_type: "ingredient",
      inventory_tracking_mode: "standard",
      inventory_rotation_method: "FIFO",
      expiry_policy: "warn_only",
      unit: input.unit,
      sale_unit: input.unit,
      base_unit: input.unit,
      sales_unit_type: salesUnitTypeForUnit(input.unit),
      allow_fractional_quantity: input.unit !== "piece",
      allow_price_input: false,
      wholesale_enabled: false,
      last_unit_cost: unitCost,
      cost_unit: input.unit,
    },
    user.id
  );
  if (!ingredient) throw new Error("المكوّن غير موجود");
  revalidatePath("/products");
  revalidatePath("/inventory");
  return ingredient;
}

export async function saveCafeMenuItemAction(input: CafeMenuItemInput) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);

  const ingredients = input.ingredients.filter(
    (line) => line.ingredient_product_id && line.quantity > 0
  );
  const variants = (input.variants ?? [])
    .map((variant) => ({
      ...variant,
      name: variant.name.trim(),
      sku: variant.sku?.trim() ?? "",
      barcode: variant.barcode?.trim() ?? "",
      price: Math.max(0, Number(variant.price) || 0),
      ingredients: variant.ingredients.filter(
        (line) => line.ingredient_product_id && line.quantity > 0
      ),
    }))
    .filter((variant) => variant.name && variant.price > 0);
  let salePrice =
    variants.length > 0
      ? Math.min(...variants.map((variant) => variant.price))
      : Math.max(0, Number(input.sale_price) || 0);
  if (input.productId && variants.length === 0 && input.sale_price == null) {
    const existing = await productService.getProduct(input.productId);
    salePrice = existing?.base_price ?? 0;
  }

  if (!input.name.trim() || !input.category_id || salePrice < 0) {
    throw new Error("اسم الصنف والفئة مطلوبان");
  }
  if (!input.productId && variants.length === 0 && salePrice <= 0) {
    throw new Error("أضف حجماً وسعراً واحداً على الأقل");
  }

  const hasRecipeLines =
    ingredients.length > 0 || variants.some((variant) => variant.ingredients.length > 0);
  if (hasRecipeLines) {
    await requireFeature("recipes");
    await requirePermissionOrRole("recipe_manage", ["owner", "manager"]);
  }

  const productInput = buildCafeMenuProductInput({ ...input, sale_price: salePrice });
  const product = input.productId
    ? await productService.updateProduct(input.productId, productInput, user.id)
    : await productService.createProduct(productInput, user.id);
  if (!product) throw new Error("تعذر حفظ صنف المنيو");

  if (ingredients.length > 0) {
    await recipeService.saveRecipe(product.id, ingredients, user.id, null);
  }
  for (const [index, variantInput] of variants.entries()) {
    const variant = await variantService.createVariant(
      product.id,
      {
        name: variantInput.name,
        sku: variantInput.sku || `${product.sku || product.id}-${index + 1}`,
        barcode: variantInput.barcode || variantInput.sku || `${product.sku || product.id}-${index + 1}`,
        price_delta: 0,
        price: variantInput.price,
        image_url: null,
        is_active: true,
        variant_kind: "standard",
        quantity_value: null,
        quantity_unit: "piece",
        price_mode: "fixed_price",
        fixed_price: variantInput.price,
      },
      user.id
    );
    if (variantInput.ingredients.length > 0) {
      await recipeService.saveRecipe(product.id, variantInput.ingredients, user.id, variant.id);
    }
  }
  revalidatePath("/products");
  revalidatePath("/pos");
  revalidatePath("/inventory");
  return product;
}

import { getFeatureFlags } from "@/modules/system/services/settings.service";
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
    recipeKeys,
    ingredients,
  ] =
    await Promise.all([
    productService.getProductsWithCategories(),
    productService.listCategories(),
    getFeatureFlags(),
    recipeService.listProductIdsWithRecipes(),
    recipeService.listRecipeKeys(),
    recipeService.listIngredients(),
  ]);
  const variantMap = await catalogRepo.listVariantsForProducts(
    rows.map(({ product }) => product.id)
  );
  const recipeSet = new Set(recipeProductIds);
  const baseRecipeSet = new Set(
    recipeKeys.filter((key) => key.variantId == null).map((key) => key.productId)
  );
  const variantRecipeSet = new Set(
    recipeKeys
      .filter((key) => key.variantId != null)
      .map((key) => `${key.productId}::${key.variantId}`)
  );
  return {
    organization: org,
    categories,
    ingredients,
    recipesEnabled: featureFlags.recipes === true,
    products: rows.map(({ product, category }) => {
      const activeVariants = (variantMap.get(product.id) ?? []).filter((v) => v.is_active);
      const missingRecipeVariantCount =
        recipeService.canProductHaveRecipe(product) && !baseRecipeSet.has(product.id)
          ? activeVariants.filter(
              (variant) => !variantRecipeSet.has(`${product.id}::${variant.id}`)
            ).length
          : 0;
      return {
        product,
        category,
        hasRecipe: recipeSet.has(product.id),
        variants: activeVariants,
        variantCount: activeVariants.length,
        missingRecipeVariantCount,
        variantPrices: activeVariants.map((variant) =>
          variantService.resolveVariantPrice(product.base_price, variant)
        ),
      };
    }),
  };
}
