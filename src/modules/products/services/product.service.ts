import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { Category, Product } from "@/lib/types";

export type ProductInput = Omit<Product, "id" | "org_id" | "updated_at">;
export type CategoryInput = Omit<Category, "id" | "org_id">;

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
    input,
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
  const product = await catalogRepo.updateProduct(id, input);
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
