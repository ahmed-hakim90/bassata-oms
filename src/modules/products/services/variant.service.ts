import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import type { ProductVariant } from "@/lib/types";

export function resolveVariantPrice(
  basePrice: number,
  variant: Pick<ProductVariant, "price" | "price_delta">
): number {
  if (variant.price != null) return variant.price;
  return basePrice + variant.price_delta;
}

export async function listVariants(productId: string) {
  return catalogRepo.listVariants(productId);
}

export async function createVariant(
  productId: string,
  input: Omit<ProductVariant, "id" | "product_id">,
  userId: string
) {
  const product = await catalogRepo.getProduct(productId);
  if (!product) throw new Error("Product not found");

  const stores = await storeRepo.listStores();
  const variant = await catalogRepo.createVariant(
    productId,
    input,
    stores.map((s) => s.id)
  );

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "variant.created",
    entityType: "product_variant",
    entityId: variant.id,
    metadata: { productId, name: variant.name },
  });

  return variant;
}

export async function updateVariant(
  id: string,
  input: Partial<Omit<ProductVariant, "id" | "product_id">>,
  userId: string
) {
  const variant = await catalogRepo.updateVariant(id, input);
  if (!variant) throw new Error("Variant not found");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "variant.updated",
    entityType: "product_variant",
    entityId: id,
    metadata: input,
  });

  return variant;
}

export async function deleteVariant(id: string, userId: string) {
  const variant = await catalogRepo.getVariant(id);
  if (!variant) throw new Error("Variant not found");

  await catalogRepo.deleteVariant(id);

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    userId,
    action: "variant.deleted",
    entityType: "product_variant",
    entityId: id,
    metadata: { productId: variant.product_id, name: variant.name },
  });

  return true;
}
