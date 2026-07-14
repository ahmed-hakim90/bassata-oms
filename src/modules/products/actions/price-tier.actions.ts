"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionOrRole } from "@/lib/auth/guards";
import type { ProductPriceTier } from "@/lib/types";
import {
  deletePriceTier,
  listPriceTiers,
  listWholesalePriceTiersByProductIds,
  upsertPriceTier,
} from "@/modules/products/services/pricing-tier.service";

export async function listPriceTiersAction(productId: string) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  return listPriceTiers(productId);
}

export async function listWholesaleTiersMapAction(
  productIds: string[]
): Promise<Record<string, ProductPriceTier[]>> {
  await requirePermissionOrRole("checkout_create", ["owner", "manager", "cashier"]);
  const map = await listWholesalePriceTiersByProductIds(productIds);
  return Object.fromEntries(map.entries());
}

export async function upsertPriceTiersAction(
  input: Omit<ProductPriceTier, "id" | "org_id" | "created_at" | "updated_at"> & { id?: string }
) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  const row = await upsertPriceTier(input);
  revalidatePath("/sales-invoices");
  revalidatePath("/pos");
  return row;
}

export async function deletePriceTiersAction(id: string) {
  await requirePermissionOrRole("product_manage", ["owner", "manager"]);
  await deletePriceTier(id);
  revalidatePath("/sales-invoices");
  revalidatePath("/pos");
}
