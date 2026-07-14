import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";
import * as stockCountRepo from "@/lib/repositories/stock-count.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Category, Product } from "@/lib/types";
import { nextSequentialProductSku } from "@/modules/products/lib/generate-product-sku";

export type ProductInput = Omit<Product, "id" | "org_id" | "updated_at">;
export type CategoryInput = Omit<Category, "id" | "org_id">;

export function deriveProductCapabilityFields(
  input: Pick<
    ProductInput,
    | "product_type"
    | "sales_unit_type"
    | "allow_price_input"
    | "inventory_tracking_mode"
    | "inventory_product_type"
    | "track_inventory"
  >
): Pick<
  ProductInput,
  "inventory_product_type" | "supports_weight_sale" | "supports_amount_sale"
> {
  const salesUnitType = input.sales_unit_type ?? "piece";
  const isWeightSale = salesUnitType === "weight" || salesUnitType === "mixed";
  const isAmountSale = isWeightSale && input.allow_price_input === true;
  const inventoryProductType =
    input.inventory_product_type === "finished" || input.inventory_product_type === "ingredient"
      ? undefined
      : input.inventory_product_type;

  return {
    inventory_product_type:
      inventoryProductType ??
      (input.product_type === "ingredient" || input.product_type === "raw_material"
        ? "raw_material"
        : input.product_type === "finished"
          ? "finished_product"
          : input.product_type),
    supports_weight_sale: isWeightSale,
    supports_amount_sale: isAmountSale,
  };
}

function toLegacyProductType(productType: ProductInput["product_type"]): ProductInput["product_type"] {
  return productType === "ingredient" || productType === "raw_material" ? "ingredient" : "finished";
}

function normalizeProductInput(input: ProductInput): ProductInput {
  const unit = input.unit ?? "piece";
  const baseUnit = input.base_unit ?? unit;
  const saleUnit = input.sale_unit ?? unit;
  const sku = input.sku?.trim() ?? "";
  const barcode = input.barcode?.trim() || sku;
  const capabilityFields = deriveProductCapabilityFields(input);
  const inventoryProductType = capabilityFields.inventory_product_type;
  const isFinishedOnlineCandidate =
    (input.product_type === "finished" || input.product_type === "finished_product") &&
    inventoryProductType === "finished_product";
  return {
    ...input,
    sku,
    barcode,
    product_type: toLegacyProductType(input.product_type),
    unit,
    base_unit: baseUnit,
    sale_unit: saleUnit,
    cost_unit: input.cost_unit ?? baseUnit,
    units_per_purchase_unit: (() => {
      const raw = Number(input.units_per_purchase_unit ?? 1);
      return Number.isFinite(raw) && raw > 0 ? raw : 1;
    })(),
    inventory_tracking_mode:
      input.track_inventory === false ? "none" : input.inventory_tracking_mode ?? "standard",
    show_on_online_menu: input.show_on_online_menu ?? isFinishedOnlineCandidate,
    ...capabilityFields,
  };
}

function productToInput(product: Product): ProductInput {
  const { id, org_id, updated_at, ...input } = product;
  void id;
  void org_id;
  void updated_at;
  return input;
}

function isRecipeIngredientConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("product_recipe_lines_ingredient_product_id_fkey")
  );
}

/** Operator-facing messages for product hard-delete FK blocks (NO ACTION refs). */
const PRODUCT_DELETE_FK_MESSAGES: Record<string, string> = {
  stock_count_lines_product_id_fkey:
    "لا يمكن حذف المنتج لأنه موجود في سجلات جرد مخزون. عطّله من التعديل بدل الحذف.",
  order_items_product_id_fkey:
    "لا يمكن حذف المنتج لأنه مستخدم في فواتير مبيعات. عطّله بدل الحذف.",
  online_order_items_product_id_fkey:
    "لا يمكن حذف المنتج لأنه مستخدم في طلبات أونلاين. عطّله بدل الحذف.",
  purchase_invoice_lines_product_id_fkey:
    "لا يمكن حذف المنتج لأنه مستخدم في فواتير شراء. عطّله بدل الحذف.",
  transfer_order_lines_product_id_fkey:
    "لا يمكن حذف المنتج لأنه مستخدم في تحويلات مخزون. عطّله بدل الحذف.",
  waste_records_product_id_fkey:
    "لا يمكن حذف المنتج لأنه مستخدم في سجلات هالك. عطّله بدل الحذف.",
  order_item_deductions_ingredient_product_id_fkey:
    "لا يمكن حذف المكون لأنه مرتبط بخصومات مخزون من مبيعات. عطّله بدل الحذف.",
  expenses_inventory_item_id_fkey:
    "لا يمكن حذف المنتج لأنه مرتبط بمصروفات. عطّله بدل الحذف.",
  product_recipe_lines_ingredient_product_id_fkey:
    "لا يمكن حذف هذا المكون لأنه مستخدم في وصفة واحدة أو أكثر. أزله من الوصفات أولاً.",
};

function mapProductDeleteConstraintError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  for (const [constraint, message] of Object.entries(PRODUCT_DELETE_FK_MESSAGES)) {
    if (error.message.includes(constraint)) return message;
  }
  if (error.message.includes("violates foreign key constraint")) {
    return "لا يمكن حذف المنتج لأنه مرتبط بعمليات سابقة. عطّله بدل الحذف.";
  }
  return null;
}

function formatIngredientRecipeUsageError(names: string[]): string {
  if (names.length === 0) {
    return "لا يمكن حذف هذا المكون لأنه مستخدم في وصفة واحدة أو أكثر. أزله من الوصفات أولاً.";
  }
  const shown = names.slice(0, 5);
  const extraCount = names.length - shown.length;
  const suffix = extraCount > 0 ? ` و${extraCount} أصناف أخرى` : "";
  return `لا يمكن حذف هذا المكون لأنه مستخدم في وصفات: ${shown.join("، ")}${suffix}. أزله من هذه الوصفات أولاً.`;
}

async function getIngredientRecipeUsageNames(productId: string): Promise<string[]> {
  const usages = await recipeRepo.listRecipeUsagesByIngredient(productId);
  if (usages.length === 0) return [];

  const products = await catalogRepo.listProducts();
  const productMap = new Map(products.map((product) => [product.id, product.name]));
  const variantRows = await Promise.all(
    [...new Set(usages.map((usage) => usage.productId))].map(async (usedProductId) => ({
      productId: usedProductId,
      variants: await catalogRepo.listVariants(usedProductId),
    }))
  );
  const variantMap = new Map<string, string>();
  for (const row of variantRows) {
    for (const variant of row.variants) {
      variantMap.set(`${row.productId}:${variant.id}`, variant.name);
    }
  }

  return [
    ...new Set(
      usages.map((usage) => {
        const productName = productMap.get(usage.productId) ?? "Unknown product";
        const variantName = usage.variantId
          ? variantMap.get(`${usage.productId}:${usage.variantId}`)
          : null;
        return variantName ? `${productName} - ${variantName}` : productName;
      })
    ),
  ];
}

export async function listProducts(options?: {
  categoryId?: string;
  activeOnly?: boolean;
  search?: string;
}): Promise<Product[]> {
  return catalogRepo.listProducts(options);
}

export async function getProduct(id: string): Promise<Product | null> {
  return catalogRepo.getProduct(id);
}

export async function createProduct(
  input: ProductInput,
  userId: string
): Promise<Product> {
  const stores = await storeRepo.listStores();
  let resolved = input;
  if (!input.sku?.trim()) {
    const products = await catalogRepo.listProducts();
    const sku = nextSequentialProductSku(products.map((product) => product.sku));
    resolved = {
      ...input,
      sku,
      barcode: input.barcode?.trim() || sku,
    };
  } else if (!input.barcode?.trim()) {
    resolved = { ...input, barcode: input.sku.trim() };
  }
  const product = await catalogRepo.createProduct(
    normalizeProductInput(resolved),
    stores.map((s) => s.id)
  );
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name },
  });
  return product;
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
  userId: string
): Promise<Product | null> {
  const existing = await catalogRepo.getProduct(id);
  if (!existing) return null;
  const product = await catalogRepo.updateProduct(
    id,
    normalizeProductInput({ ...productToInput(existing), ...input })
  );
  if (product) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "product.updated",
      entityType: "product",
      entityId: id,
    });
  }
  return product;
}

export async function deleteProduct(id: string, userId: string): Promise<boolean> {
  const usageNames = await getIngredientRecipeUsageNames(id);
  if (usageNames.length > 0) {
    throw new Error(formatIngredientRecipeUsageError(usageNames));
  }
  if (await stockCountRepo.productHasStockCountLines(id)) {
    throw new Error(PRODUCT_DELETE_FK_MESSAGES.stock_count_lines_product_id_fkey);
  }

  let ok: boolean;
  try {
    ok = await catalogRepo.deleteProduct(id);
  } catch (error) {
    if (isRecipeIngredientConstraintError(error)) {
      throw new Error(formatIngredientRecipeUsageError(await getIngredientRecipeUsageNames(id)));
    }
    const mapped = mapProductDeleteConstraintError(error);
    if (mapped) throw new Error(mapped);
    throw error;
  }
  if (ok) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "product.deleted",
      entityType: "product",
      entityId: id,
    });
  }
  return ok;
}

export async function listCategories(): Promise<Category[]> {
  return catalogRepo.listCategories();
}

export async function getCategory(id: string): Promise<Category | null> {
  const cats = await catalogRepo.listCategories();
  return cats.find((c) => c.id === id) ?? null;
}

export async function createCategory(
  input: CategoryInput,
  userId: string
): Promise<Category> {
  const category = await catalogRepo.createCategory(input);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
  });
  return category;
}

export async function updateCategory(
  id: string,
  input: Partial<CategoryInput>,
  userId: string
): Promise<Category | null> {
  const category = await catalogRepo.updateCategory(id, input);
  if (category) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "category.updated",
      entityType: "category",
      entityId: id,
    });
  }
  return category;
}

export async function deleteCategory(id: string, userId: string): Promise<boolean> {
  const ok = await catalogRepo.deleteCategory(id);
  if (ok) {
    const orgId = await getOrgId();
    await writeAuditLog({
      orgId,
      userId,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
    });
  }
  return ok;
}

export async function getProductsWithCategories() {
  const categories = await listCategories();
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
  const products = await listProducts();
  return products.map((product) => ({
    product,
    category: byId[product.category_id] ?? null,
  }));
}
