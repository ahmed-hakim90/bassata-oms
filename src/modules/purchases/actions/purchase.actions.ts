"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireFeature, requirePermissionOrRole, getValidatedActiveStoreId } from "@/lib/auth/guards";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as orgRepo from "@/lib/repositories/organization.repository";
import {
  addPurchaseLine,
  allocatedPurchaseLineQty,
  convertPurchaseDocument,
  createDraftPurchase,
  createDraftPurchasesFromReorder,
  deleteDraftPurchase,
  getPurchase,
  importPurchaseOrdersIntoInvoice,
  listImportablePurchaseOrders,
  listPurchaseDocuments,
  postPurchaseReturn,
  receivePurchase,
  remainingPurchaseLineQty,
  removePurchaseLine,
  transitionPurchaseDocument,
  updateDraftPurchase,
  updatePurchaseLine,
  voidReceivedPurchase,
  type ImportablePurchaseOrder,
} from "@/modules/purchases/services/purchase.service";
import {
  createSupplier,
  listSuppliers,
} from "@/modules/purchases/services/supplier.service";
import { listSupplierSummaries } from "@/modules/suppliers/services/supplier.service";
import type { MeasurementUnit, PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";
import type {
  PurchaseWithLines,
  ReceivePurchaseResult,
} from "@/modules/purchases/services/purchase.service";
import { getSupplierPriceHistory } from "@/modules/purchases/services/price-history.service";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";

export type PurchaseActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "تعذر تنفيذ العملية";
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
    if (!purchase) throw new Error("فاتورة الشراء غير موجودة");
    return purchase;
  });
}

export async function createPurchaseAction(input: {
  warehouseId: string;
  supplierId?: string | null;
  extraCost?: number;
  documentDate?: string;
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  currency?: string;
  fxRate?: number;
}): Promise<PurchaseActionResult<PurchaseInvoice>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    const kind = input.documentKind ?? "purchase_invoice";
    const invoice = await createDraftPurchase({
      storeId,
      warehouseId: input.warehouseId,
      supplierId: input.supplierId ?? null,
      extraCost: input.extraCost,
      createdBy: user.id,
      documentDate: input.documentDate,
      documentKind: kind,
      currency: input.currency,
      fxRate: input.fxRate,
    });
    revalidatePath("/inventory/purchases");
    revalidatePath("/inventory/purchase-requests");
    revalidatePath("/inventory/purchase-orders");
    revalidatePath("/inventory/purchase-returns");
    revalidatePath("/inventory/containers");
    revalidatePath("/inventory/customs-certificates");
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
  foreignUnitCost?: number | null;
  sourceLineId?: string | null;
  discountAmount?: number;
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
  discountAmount?: number;
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
  supplierId?: string | null;
  invoiceNumber?: string;
  extraCost?: number;
  documentDate?: string;
  documentNotes?: string;
  currency?: string;
  fxRate?: number;
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
    if (!purchase) throw new Error("فاتورة الشراء غير موجودة");
    revalidatePath("/inventory/purchases");
    revalidatePath("/inventory");
    revalidatePath("/inventory/suppliers");
    revalidatePath("/treasury");
    return purchase;
  });
}

export async function receivePurchaseAction(
  invoiceId: string,
  options?: {
    amountPaid?: number;
    paymentMethod?: import("@/lib/types").PaymentMethod;
  }
): Promise<PurchaseActionResult<ReceivePurchaseResult>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const invoice = await receivePurchase(invoiceId, user.id, options);
    // Keep the action snappy — list/inventory refresh after the response.
    after(() => {
      revalidatePath("/inventory/purchases");
      revalidatePath("/inventory");
    });
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
        address: "",
        tax_id: "",
      },
      user.id
    );
    revalidatePath("/inventory/purchases");
    return supplier;
  });
}

export async function getPurchasesData(
  kind: NonNullable<PurchaseInvoice["document_kind"]> = "purchase_invoice"
) {
  await requireFeature("purchases");
  const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
  const storeId = await getValidatedActiveStoreId();

  const [org, warehouses, purchases, suppliers, products, supplierSummaries, importsEnabled] =
    await Promise.all([
      orgRepo.getOrganization(),
      warehouseRepo.listWarehouses(storeId),
      listPurchaseDocuments(storeId, kind),
      listSuppliers(),
      catalogRepo.listProducts(),
      kind === "purchase_invoice"
        ? listSupplierSummaries(storeId)
        : Promise.resolve([] as Awaited<ReturnType<typeof listSupplierSummaries>>),
      isFeatureEnabled("purchase_imports"),
    ]);

  const priceHistory =
    kind === "purchase_invoice"
      ? await getSupplierPriceHistory(storeId, {
          purchases,
          suppliers,
          products,
        })
      : [];

  const supplierDueTotal = supplierSummaries.reduce(
    (sum, row) => sum + Math.max(0, row.balanceDue),
    0
  );

  return {
    purchases,
    priceHistory,
    suppliers,
    products: products.filter((p) => p.is_active),
    warehouses,
    storeId,
    currency: org.currency,
    supplierDueTotal,
    canManagePrintEngine: user.role === "owner" || user.role === "manager",
    importsEnabled,
  };
}

function revalidatePurchasePaths() {
  revalidatePath("/inventory/purchases");
  revalidatePath("/inventory/purchase-requests");
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/purchase-returns");
}

export async function transitionPurchaseDocumentAction(input: {
  invoiceId: string;
  from: PurchaseInvoice["status"];
  to: PurchaseInvoice["status"];
}): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const updated = await transitionPurchaseDocument(input);
    revalidatePurchasePaths();
    return updated;
  });
}

export async function convertPurchaseDocumentAction(input: {
  sourceId: string;
  targetKind: "purchase_order" | "purchase_invoice" | "purchase_return";
  fromStatus: PurchaseInvoice["status"];
  lockStatus?: PurchaseInvoice["status"];
  supplierId?: string | null;
  lines?: Array<{ sourceLineId: string; quantity: number }>;
}): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const created = await convertPurchaseDocument({
      ...input,
      createdBy: user.id,
    });
    revalidatePurchasePaths();
    return created;
  });
}

export async function previewPurchaseConvertAction(
  sourceId: string
): Promise<
  PurchaseActionResult<
    Array<{
      sourceLineId: string;
      productId: string;
      quantity: number;
      remaining: number;
      unitCost: number;
    }>
  >
> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const source = await getPurchase(sourceId);
    if (!source) throw new Error("المستند غير موجود");
    const rows = [];
    for (const line of source.lines) {
      const allocated = await allocatedPurchaseLineQty(line.id);
      rows.push({
        sourceLineId: line.id,
        productId: line.product_id,
        quantity: line.quantity,
        remaining: remainingPurchaseLineQty(line.quantity, allocated),
        unitCost: line.unit_cost,
      });
    }
    return rows;
  });
}

export async function listImportablePurchaseOrdersAction(input?: {
  supplierId?: string | null;
  warehouseId?: string | null;
}): Promise<PurchaseActionResult<ImportablePurchaseOrder[]>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const storeId = await getValidatedActiveStoreId();
    return listImportablePurchaseOrders({
      storeId,
      supplierId: input?.supplierId,
      warehouseId: input?.warehouseId,
    });
  });
}

export async function importPurchaseOrdersIntoInvoiceAction(input: {
  invoiceId: string;
  sourceIds: string[];
}): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const updated = await importPurchaseOrdersIntoInvoice(input);
    revalidatePurchasePaths();
    return updated;
  });
}

export async function postPurchaseReturnAction(
  invoiceId: string
): Promise<PurchaseActionResult<PurchaseWithLines>> {
  return runPurchaseAction(async () => {
    await requireFeature("purchases");
    const user = await requirePermissionOrRole("purchase_manage", ["owner", "manager", "inventory"]);
    const posted = await postPurchaseReturn(invoiceId, user.id);
    revalidatePurchasePaths();
    revalidatePath("/inventory");
    return posted;
  });
}
