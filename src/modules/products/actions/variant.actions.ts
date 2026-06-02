"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import * as variantService from "@/modules/products/services/variant.service";
import type { ProductVariant } from "@/lib/types";

export async function listVariantsAction(productId: string) {
  await requirePermissionOrRole("product_manage", ["owner", "manager", "inventory"]);
  return variantService.listVariants(productId);
}

export async function createVariantAction(
  productId: string,
  input: Omit<ProductVariant, "id" | "product_id">
) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const variant = await variantService.createVariant(productId, input, user.id);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return variant;
}

export async function updateVariantAction(
  id: string,
  input: Partial<Omit<ProductVariant, "id" | "product_id">>
) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const variant = await variantService.updateVariant(id, input, user.id);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return variant;
}

export async function deleteVariantAction(id: string) {
  const user = await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  await variantService.deleteVariant(id, user.id);
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/pos");
  return true;
}
