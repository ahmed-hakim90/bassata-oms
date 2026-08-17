"use server";

import { revalidatePath } from "next/cache";
import {
  getValidatedActiveStoreId,
  requirePermissionOrRole,
} from "@/lib/auth/guards";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { getOrganization } from "@/lib/repositories/organization.repository";
import { listCustomers } from "@/modules/customers/services/customer.service";
import { listWholesalePriceTiersByProductIds } from "@/modules/products/services/pricing-tier.service";
import type { PaymentMethod, PaymentSplit, ProductPriceTier } from "@/lib/types";
import { enabledPaymentMethodsFromFlags } from "@/lib/enabled-payment-methods";
import { getFeatureFlags } from "@/modules/system/services/settings.service";
import {
  addSalesInvoiceLine,
  assertSalesInvoiceAccess,
  convertSalesDocument,
  correctDeliveredSalesInvoiceCosts,
  createCreditNoteFromInvoice,
  createDraftSalesInvoice,
  deleteDraftSalesInvoice,
  deliverSalesInvoice,
  getSalesInvoice,
  importSalesSourcesIntoInvoice,
  issueSalesCreditNote,
  issueSalesInvoice,
  listImportableSalesSources,
  listSalesDocuments,
  removeSalesInvoiceLine,
  transitionSalesDocument,
  updateDraftSalesInvoiceHeader,
  updateSalesInvoiceLine,
  type CorrectDeliveredCostsResult,
  type ImportableSalesSource,
  type SalesInvoiceLineMutationResult,
  type SalesInvoiceWithDetails,
} from "@/modules/sales-invoices/services/sales-invoice.service";
import type { Order } from "@/lib/types";

export type SalesInvoiceActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  return e instanceof Error ? e.message : "حصل خطأ";
}

async function runAction<T>(fn: () => Promise<T>): Promise<SalesInvoiceActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

async function requireSalesInvoiceUser() {
  const user = await requirePermissionOrRole("checkout_create", [
    "owner",
    "manager",
    "cashier",
  ]);
  await assertSalesInvoiceAccess(user);
  return user;
}

export async function getSalesInvoicesData(
  kind: NonNullable<Order["document_kind"]> = "sales_invoice"
) {
  const user = await requireSalesInvoiceUser();
  const storeId = await getValidatedActiveStoreId();
  const [invoices, customers, products, warehouses, organization, flags] = await Promise.all([
    listSalesDocuments(storeId, kind),
    listCustomers(),
    catalogRepo.listProducts({ activeOnly: true }),
    warehouseRepo.listWarehouses(storeId),
    getOrganization(),
    getFeatureFlags(),
  ]);
  const activeProducts = products.filter((p) => p.is_active);
  const tiersMap = await listWholesalePriceTiersByProductIds(activeProducts.map((p) => p.id));
  const wholesaleTiersByProductId: Record<string, ProductPriceTier[]> = Object.fromEntries(
    tiersMap.entries()
  );
  return {
    invoices,
    customers,
    products: activeProducts,
    warehouses: warehouses.filter((w) => w.is_active),
    wholesaleTiersByProductId,
    currency: organization.currency,
    enabledPaymentMethods: enabledPaymentMethodsFromFlags(flags),
    canCorrectCosts: user.role === "owner" || user.role === "manager",
    canManagePrintEngine: user.role === "owner" || user.role === "manager",
    userId: user.id,
  };
}

export async function getSalesInvoiceDetailAction(
  orderId: string
): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const invoice = await getSalesInvoice(orderId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    return invoice;
  });
}

export async function createSalesInvoiceAction(input: {
  warehouseId: string;
  customerId?: string | null;
  documentDate?: string;
  documentKind?: NonNullable<Order["document_kind"]>;
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    const user = await requireSalesInvoiceUser();
    const storeId = await getValidatedActiveStoreId();
    const created = await createDraftSalesInvoice({
      storeId,
      warehouseId: input.warehouseId,
      customerId: input.customerId,
      createdBy: user.id,
      documentDate: input.documentDate,
      documentKind: input.documentKind ?? "sales_invoice",
    });
    // Return the insert row immediately — extra getSalesInvoice + revalidatePath
    // blocked the form from opening. List refreshes when the operator closes.
    return {
      ...created,
      lines: [],
      customerName: null,
      warehouseName: null,
    };
  });
}

/** Fresh products + wholesale tiers for open draft entry (avoids full page refresh). */
export async function getSalesInvoiceCatalogAction(): Promise<
  SalesInvoiceActionResult<{
    products: Awaited<ReturnType<typeof catalogRepo.listProducts>>;
    wholesaleTiersByProductId: Record<string, ProductPriceTier[]>;
  }>
> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const products = (await catalogRepo.listProducts({ activeOnly: true })).filter(
      (product) => product.is_active
    );
    const tiersMap = await listWholesalePriceTiersByProductIds(products.map((p) => p.id));
    return {
      products,
      wholesaleTiersByProductId: Object.fromEntries(tiersMap.entries()),
    };
  });
}

export async function updateSalesInvoiceHeaderAction(input: {
  orderId: string;
  customerId?: string | null;
  warehouseId?: string;
  discount?: number;
  documentDate?: string;
  documentNotes?: string;
  validUntil?: string | null;
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    await updateDraftSalesInvoiceHeader(input);
    const invoice = await getSalesInvoice(input.orderId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    // Skip revalidatePath — draft header edits stay local; list refreshes on lifecycle.
    return invoice;
  });
}

export async function addSalesInvoiceLineAction(input: {
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
  tierId?: string | null;
  discountAmount?: number;
}): Promise<SalesInvoiceActionResult<SalesInvoiceLineMutationResult>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    // Return line + totals only — full invoice reload was ~half the latency.
    return addSalesInvoiceLine(input);
  });
}

export async function updateSalesInvoiceLineAction(input: {
  orderId: string;
  lineId: string;
  quantity: number;
  unitPrice?: number;
  repriceFromTiers?: boolean;
  discountAmount?: number;
}): Promise<SalesInvoiceActionResult<SalesInvoiceLineMutationResult>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    return updateSalesInvoiceLine(input);
  });
}

export async function removeSalesInvoiceLineAction(input: {
  orderId: string;
  lineId: string;
}): Promise<
  SalesInvoiceActionResult<{
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  }>
> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    return removeSalesInvoiceLine(input.lineId);
  });
}

export async function deleteDraftSalesInvoiceAction(
  orderId: string
): Promise<SalesInvoiceActionResult> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    await deleteDraftSalesInvoice(orderId);
    revalidatePath("/sales-invoices");
  });
}

export async function issueSalesInvoiceAction(
  orderId: string
): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    await issueSalesInvoice(orderId);
    const invoice = await getSalesInvoice(orderId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    revalidatePath("/sales-invoices");
    revalidatePath("/orders");
    return invoice;
  });
}

export async function deliverSalesInvoiceAction(input: {
  orderId: string;
  paymentMethod: PaymentMethod | null;
  payments?: PaymentSplit[];
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    await deliverSalesInvoice(input);
    const invoice = await getSalesInvoice(input.orderId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    revalidatePath("/sales-invoices");
    revalidatePath("/orders");
    return invoice;
  });
}

/** Owner/manager: re-apply current product purchase costs onto a delivered invoice. */
export async function correctDeliveredSalesInvoiceCostsAction(
  orderId: string
): Promise<
  SalesInvoiceActionResult<{
    invoice: SalesInvoiceWithDetails;
    correction: CorrectDeliveredCostsResult;
  }>
> {
  return runAction(async () => {
    const user = await requirePermissionOrRole("checkout_create", [
      "owner",
      "manager",
    ]);
    await assertSalesInvoiceAccess(user);
    const correction = await correctDeliveredSalesInvoiceCosts(orderId, user);
    const invoice = await getSalesInvoice(orderId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    revalidatePath("/sales-invoices");
    revalidatePath("/orders");
    revalidatePath("/reports/profit");
    return { invoice, correction };
  });
}

export async function transitionSalesDocumentAction(input: {
  orderId: string;
  from: NonNullable<Order["document_status"]>;
  to: NonNullable<Order["document_status"]>;
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const invoice = await transitionSalesDocument(input);
    revalidatePath("/quotations");
    revalidatePath("/sales-orders");
    revalidatePath("/sales-invoices");
    revalidatePath("/credit-notes");
    return invoice;
  });
}

export async function convertSalesDocumentAction(input: {
  sourceId: string;
  targetKind: "sales_order" | "sales_invoice";
  fromStatus: NonNullable<Order["document_status"]>;
  lockStatus: NonNullable<Order["document_status"]>;
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    const user = await requireSalesInvoiceUser();
    const created = await convertSalesDocument({
      ...input,
      createdBy: user.id,
    });
    revalidatePath("/quotations");
    revalidatePath("/sales-orders");
    revalidatePath("/sales-invoices");
    return created;
  });
}

export async function listImportableSalesSourcesAction(input?: {
  customerId?: string | null;
  warehouseId?: string | null;
}): Promise<SalesInvoiceActionResult<ImportableSalesSource[]>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const storeId = await getValidatedActiveStoreId();
    return listImportableSalesSources({
      storeId,
      customerId: input?.customerId,
      warehouseId: input?.warehouseId,
    });
  });
}

export async function importSalesSourcesIntoInvoiceAction(input: {
  invoiceId: string;
  sourceIds: string[];
}): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const updated = await importSalesSourcesIntoInvoice(input);
    revalidatePath("/quotations");
    revalidatePath("/sales-orders");
    revalidatePath("/sales-invoices");
    return updated;
  });
}

export async function createCreditNoteFromInvoiceAction(
  sourceId: string
): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    const user = await requireSalesInvoiceUser();
    const created = await createCreditNoteFromInvoice({
      sourceId,
      createdBy: user.id,
    });
    revalidatePath("/credit-notes");
    revalidatePath("/sales-invoices");
    return created;
  });
}

export async function issueSalesCreditNoteAction(
  orderId: string
): Promise<SalesInvoiceActionResult<SalesInvoiceWithDetails>> {
  return runAction(async () => {
    await requireSalesInvoiceUser();
    const issued = await issueSalesCreditNote(orderId);
    revalidatePath("/credit-notes");
    return issued;
  });
}
