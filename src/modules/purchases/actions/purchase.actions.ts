"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import {
  addPurchaseLine,
  createDraftPurchase,
  createDraftPurchasesFromReorder,
  deleteDraftPurchase,
  enrichPurchases,
  getPurchase,
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
import type { MeasurementUnit, PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";
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
  documentDate?: string;
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
      documentDate: input.documentDate,
    });
    revalidatePath("/inventory/purchases");
    return invoice;
  });
}

/** Creates draft purchase invoice(s) from inventory reorder suggestions for review. */
export async function createPurchaseDraftFromReorderAction(
  lines: { productId: string; warehouseId: string; quantity: number }[]
): Promise<PurchaseActionResult<{ invoiceIds: string[]; count: number }>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    const invoices = await createDraftPurchasesFromReorder({
      storeId,
      createdBy: user.id,
      lines,
    });
    // Purchases list is the next screen; inventory hub refreshes when operator returns.
    revalidatePath("/inventory/purchases");
    return {
      invoiceIds: invoices.map((invoice) => invoice.id),
      count: invoices.length,
    };
  });
}

export async function addPurchaseLineAction(input: {
  invoiceId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  entryUnit?: MeasurementUnit;
  batchNumber?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
}): Promise<PurchaseActionResult<PurchaseInvoiceLine>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    // Skip revalidatePath — draft line edits stay local; list refreshes on create/receive/delete.
    return addPurchaseLine(input);
  });
}

export async function updatePurchaseLineAction(input: {
  lineId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
}): Promise<PurchaseActionResult<PurchaseInvoiceLine>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    return updatePurchaseLine(input);
  });
}

export async function updateDraftPurchaseAction(input: {
  invoiceId: string;
  supplierId?: string;
  invoiceNumber?: string;
  extraCost?: number;
  documentDate?: string;
}): Promise<PurchaseActionResult<PurchaseInvoice>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const { invoiceId, ...updates } = input;
    return updateDraftPurchase(invoiceId, updates);
  });
}

export async function removePurchaseLineAction(
  lineId: string
): Promise<PurchaseActionResult> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    await removePurchaseLine(lineId);
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

export async function voidPurchaseAction(
  invoiceId: string
): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager"]);
    await voidReceivedPurchase(invoiceId, user.id);
    const purchase = await getPurchase(invoiceId);
    if (!purchase) throw new Error("Purchase not found");
    revalidatePath("/inventory/purchases");
    revalidatePath("/inventory");
    return purchase;
  });
}

export async function receivePurchaseAction(
  invoiceId: string,
  options?: {
    amountPaid?: number;
    paymentMethod?: import("@/lib/types").PaymentMethod;
  }
): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const invoice = await receivePurchase(invoiceId, user.id, options);
    // One list path is enough; inventory/suppliers refresh on next visit.
    revalidatePath("/inventory/purchases");
    return invoice;
  });
}

export async function createSupplierAction(input: {
  name: string;
  contactInfo: string;
  openingBalance?: number;
}): Promise<PurchaseActionResult<import("@/lib/types").Supplier>> {
  return runPurchaseAction(async () => {
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager"]);
    const opening = input.openingBalance ?? 0;
    if (!Number.isFinite(opening) || opening < 0) {
      throw new Error("رصيد مستحق سابق لازم يكون صفر أو أكبر");
    }
    const supplier = await createSupplier(
      {
        name: input.name,
        contact_info: input.contactInfo,
        opening_balance: opening,
      },
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

  const [org, warehouses, invoices, suppliers, products] = await Promise.all([
    orgRepo.getOrganization(),
    warehouseRepo.listWarehouses(storeId),
    purchaseRepo.listPurchases(storeId),
    listSuppliers(),
    catalogRepo.listProducts(),
  ]);

  const purchases = await enrichPurchases(invoices, { suppliers, warehouses });
  const priceHistory = await getSupplierPriceHistory(storeId, {
    purchases,
    suppliers,
    products,
  });

  return {
    purchases,
    priceHistory,
    suppliers,
    products: products.filter((p) => p.is_active),
    warehouses,
    storeId,
    currency: org.currency,
  };
}
