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
  correctDeliveredSalesInvoiceCosts,
  createDraftSalesInvoice,
  deleteDraftSalesInvoice,
  deliverSalesInvoice,
  getSalesInvoice,
  issueSalesInvoice,
  listSalesInvoices,
  removeSalesInvoiceLine,
  updateDraftSalesInvoiceHeader,
  updateSalesInvoiceLine,
  type CorrectDeliveredCostsResult,
  type SalesInvoiceLineMutationResult,
  type SalesInvoiceWithDetails,
} from "@/modules/sales-invoices/services/sales-invoice.service";

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

export async function getSalesInvoicesData() {
  const user = await requireSalesInvoiceUser();
  const storeId = await getValidatedActiveStoreId();
  const [invoices, customers, products, warehouses, organization, flags] = await Promise.all([
    listSalesInvoices(storeId),
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
    });
    const invoice = await getSalesInvoice(created.id);
    if (!invoice) throw new Error("تعذر فتح المسودة بعد الإنشاء");
    revalidatePath("/sales-invoices");
    return invoice;
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

/** Dashboard / one-click: draft on default warehouse, then open `/sales-invoices?open=…`. */
export async function quickCreateSalesInvoiceAction(): Promise<
  SalesInvoiceActionResult<{ id: string }>
> {
  return runAction(async () => {
    const user = await requireSalesInvoiceUser();
    const storeId = await getValidatedActiveStoreId();
    const warehouse = await warehouseRepo.getDefaultWarehouse(storeId);
    if (!warehouse?.is_active) {
      throw new Error("مفيش مخزن افتراضي نشط — اختار مخزن من فواتير المبيعات");
    }
    const invoice = await createDraftSalesInvoice({
      storeId,
      warehouseId: warehouse.id,
      customerId: null,
      createdBy: user.id,
    });
    revalidatePath("/sales-invoices");
    revalidatePath("/");
    return { id: invoice.id };
  });
}

export async function updateSalesInvoiceHeaderAction(input: {
  orderId: string;
  customerId?: string | null;
  warehouseId?: string;
  discount?: number;
  documentDate?: string;
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
