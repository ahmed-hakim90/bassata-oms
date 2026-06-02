"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  addPurchaseLine,
  createDraftPurchase,
  deleteDraftPurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
  removePurchaseLine,
  updateDraftPurchase,
  updatePurchaseLine,
  voidReceivedPurchase,
} from "@/modules/purchases/services/purchase.service";
import {
  createSupplier,
  listSuppliers,
} from "@/modules/purchases/services/supplier.service";
import type { PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";
import type { PurchaseWithLines } from "@/modules/purchases/services/purchase.service";
import { getSupplierPriceHistory } from "@/modules/purchases/services/price-history.service";

export type PurchaseActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

async function runPurchaseAction<T>(fn: () => Promise<T>): Promise<PurchaseActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function getPurchaseDetailAction(
  invoiceId: string
): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const purchase = await getPurchase(invoiceId);
    if (!purchase) throw new Error("Purchase not found");
    return purchase;
  });
}

export async function createPurchaseAction(input: {
  warehouseId: string;
  supplierId: string;
  invoiceNumber: string;
  extraCost?: number;
}): Promise<PurchaseActionResult<PurchaseInvoice>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    const invoice = await createDraftPurchase({
      storeId,
      warehouseId: input.warehouseId,
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber,
      extraCost: input.extraCost,
      createdBy: user.id,
    });
    revalidatePath("/inventory/purchases");
    return invoice;
  });
}

export async function addPurchaseLineAction(input: {
  invoiceId: string;
  productId: string;
  quantity: number;
  unitCost: number;
}): Promise<PurchaseActionResult<PurchaseInvoiceLine>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const line = await addPurchaseLine(input);
    revalidatePath("/inventory/purchases");
    return line;
  });
}

export async function updatePurchaseLineAction(input: {
  lineId: string;
  quantity: number;
  unitCost: number;
}): Promise<PurchaseActionResult<PurchaseInvoiceLine>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const line = await updatePurchaseLine(input);
    revalidatePath("/inventory/purchases");
    return line;
  });
}

export async function updateDraftPurchaseAction(input: {
  invoiceId: string;
  supplierId?: string;
  invoiceNumber?: string;
  extraCost?: number;
}): Promise<PurchaseActionResult<PurchaseInvoice>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const { invoiceId, ...updates } = input;
    const invoice = await updateDraftPurchase(invoiceId, updates);
    revalidatePath("/inventory/purchases");
    return invoice;
  });
}

export async function removePurchaseLineAction(
  lineId: string
): Promise<PurchaseActionResult> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    await removePurchaseLine(lineId);
    revalidatePath("/inventory/purchases");
  });
}

export async function deleteDraftPurchaseAction(
  invoiceId: string
): Promise<PurchaseActionResult> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    await deleteDraftPurchase(invoiceId, user.id);
    revalidatePath("/inventory/purchases");
  });
}

export async function voidPurchaseAction(invoiceId: string): Promise<PurchaseActionResult> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager"]);
    await voidReceivedPurchase(invoiceId, user.id);
    revalidatePath("/inventory/purchases");
    revalidatePath("/inventory");
  });
}

export async function receivePurchaseAction(
  invoiceId: string
): Promise<PurchaseActionResult<PurchaseInvoice>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const invoice = await receivePurchase(invoiceId, user.id);
    revalidatePath("/inventory/purchases");
    revalidatePath("/inventory");
    return invoice;
  });
}

export async function createSupplierAction(input: {
  name: string;
  contactInfo: string;
}): Promise<PurchaseActionResult<import("@/lib/types").Supplier>> {
  return runPurchaseAction(async () => {
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager"]);
    const supplier = await createSupplier(
      { name: input.name, contact_info: input.contactInfo },
      user.id
    );
    revalidatePath("/inventory/purchases");
    return supplier;
  });
}

export async function getPurchasesData() {
  await requireFeature("purchases");
  await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();
  const org = await orgRepo.getOrganization();
  const warehouses = await warehouseRepo.listWarehouses(storeId);
  return {
    purchases: await listPurchases(storeId),
    priceHistory: await getSupplierPriceHistory(storeId),
    suppliers: await listSuppliers(),
    products: await catalogRepo.listProducts({ activeOnly: true }),
    warehouses,
    storeId,
    currency: org.currency,
  };
}
