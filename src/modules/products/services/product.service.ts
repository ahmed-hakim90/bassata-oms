import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Category, Product } from "@/lib/types";

export type ProductInput = Omit<Product, "id" | "org_id" | "updated_at">;
export type CategoryInput = Omit<Category, "id" | "org_id">;

export function deriveProductCapabilityFields(
  input: Pick<
    ProductInput,
    | "product_type"
    | "sales_unit_type"
    | "allow_price_input"
    | "inventory_tracking_mode"
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
    input.product_type === "ingredient" ? "raw_material" : input.product_type;

  return {
    inventory_product_type: inventoryProductType,
    supports_weight_sale: isWeightSale,
    supports_amount_sale: isAmountSale,
  };
}

function normalizeProductInput(input: ProductInput): ProductInput {
  const unit = input.unit ?? "piece";
  const baseUnit = input.base_unit ?? unit;
  const saleUnit = input.sale_unit ?? unit;
  return {
    ...input,
    unit,
    base_unit: baseUnit,
    sale_unit: saleUnit,
    cost_unit: input.cost_unit ?? baseUnit,
    inventory_tracking_mode:
      input.track_inventory === false ? "none" : input.inventory_tracking_mode ?? "standard",
    ...deriveProductCapabilityFields(input),
  };
}

function productToInput(product: Product): ProductInput {
  const { id, org_id, updated_at, ...input } = product;
  void id;
  void org_id;
  void updated_at;
  return input;
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
  const product = await catalogRepo.createProduct(
    normalizeProductInput(input),
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
  const ok = await catalogRepo.deleteProduct(id);
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
