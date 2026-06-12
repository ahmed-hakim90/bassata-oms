"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import type { ProductPriceTier } from "@/lib/types";
import {
  deletePriceTier,
  listPriceTiers,
  upsertPriceTier,
} from "@/modules/products/services/pricing-tier.service";

export async function listPriceTiersAction(productId: string) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  return listPriceTiers(productId);
}

export async function upsertPriceTierAction(
  input: Omit<ProductPriceTier, "id" | "org_id" | "created_at" | "updated_at"> & { id?: string }
) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const row = await upsertPriceTier(input);
  revalidatePath("/products");
  revalidatePath("/pos");
  return row;
}

export async function deletePriceTierAction(id: string) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  await deletePriceTier(id);
  revalidatePath("/products");
  revalidatePath("/pos");
}
