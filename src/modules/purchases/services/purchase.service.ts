import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import {
  documentDateToOccurredAt,
  normalizeDocumentDate,
  todayDocumentDate,
} from "@/lib/document-date";
import { adjustStock, getStockLevel } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { convertPurchaseEntryToBase, productPurchaseFactor } from "@/lib/units";
import { lineTotalAfterDiscount } from "@/lib/line-discount";
import type { MeasurementUnit, PaymentMethod, PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import { remainingPurchaseLineQty } from "@/modules/purchases/lib/remaining-qty";
import { after } from "next/server";

export interface PurchaseWithLines extends PurchaseInvoice {
  lines: PurchaseInvoiceLine[];
  supplierName: string;
  warehouseName: string;
  supplierAddress: string | null;
  supplierTaxId: string | null;
  supplierContact: string | null;
}

export function allocateLandedCosts(
  lines: PurchaseInvoiceLine[],
  extraCost: number
): Map<string, { landedUnitCost: number; landedLineTotal: number }> {
  const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);
  const allocations = new Map<string, { landedUnitCost: number; landedLineTotal: number }>();
  if (lines.length === 0) return allocations;

  let allocatedExtra = 0;
  lines.forEach((line, index) => {
    const baseShare = subtotal > 0 ? line.line_total / subtotal : 1 / lines.length;
    const lineExtra =
      index === lines.length - 1
        ? Number((extraCost - allocatedExtra).toFixed(2))
        : Number((extraCost * baseShare).toFixed(2));
    allocatedExtra += lineExtra;
    const landedLineTotal = Number((line.line_total + lineExtra).toFixed(2));
    const landedUnitCost = line.quantity > 0
      ? Number((landedLineTotal / line.quantity).toFixed(4))
      : line.unit_cost;
    allocations.set(line.id, { landedUnitCost, landedLineTotal });
  });

  return allocations;
}

function enrichPurchasesInMemory(
  invoices: PurchaseInvoice[],
  lines: PurchaseInvoiceLine[],
  suppliers: Awaited<ReturnType<typeof purchaseRepo.listSuppliers>>,
  warehouses: Awaited<ReturnType<typeof warehouseRepo.listWarehouses>>
): PurchaseWithLines[] {
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const linesByInvoice = new Map<string, PurchaseInvoiceLine[]>();
  for (const line of lines) {
    const list = linesByInvoice.get(line.invoice_id) ?? [];
    list.push(line);
    linesByInvoice.set(line.invoice_id, list);
  }
  return invoices.map((invoice) => {
    const supplier = invoice.supplier_id ? supplierMap.get(invoice.supplier_id) : undefined;
    return {
      ...invoice,
      lines: linesByInvoice.get(invoice.id) ?? [],
      supplierName: supplier?.name ?? (invoice.supplier_id ? "مورد غير معروف" : "بدون مورد"),
      warehouseName: warehouseMap.get(invoice.warehouse_id) ?? "مخزن غير معروف",
      supplierAddress: supplier?.address ?? null,
      supplierTaxId: supplier?.tax_id ?? null,
      supplierContact: supplier?.contact_info ?? null,
    };
  });
}

async function enrichPurchase(invoice: PurchaseInvoice): Promise<PurchaseWithLines> {
  const [suppliers, warehouses, lines] = await Promise.all([
    purchaseRepo.listSuppliers(),
    warehouseRepo.listWarehouses(invoice.store_id),
    purchaseRepo.getPurchaseLines(invoice.id),
  ]);
  return enrichPurchasesInMemory([invoice], lines, suppliers, warehouses)[0]!;
}

/** Batch-enrich invoices with one lines/suppliers/warehouses pass. */
export async function enrichPurchases(
  invoices: PurchaseInvoice[],
  options?: {
    suppliers?: Awaited<ReturnType<typeof purchaseRepo.listSuppliers>>;
    warehouses?: Awaited<ReturnType<typeof warehouseRepo.listWarehouses>>;
  }
): Promise<PurchaseWithLines[]> {
  if (invoices.length === 0) return [];
  const storeIds = [...new Set(invoices.map((i) => i.store_id))];
  const [suppliers, warehouses, lines] = await Promise.all([
    options?.suppliers
      ? Promise.resolve(options.suppliers)
      : purchaseRepo.listSuppliers(),
    options?.warehouses
      ? Promise.resolve(options.warehouses)
      : storeIds.length === 1
        ? warehouseRepo.listWarehouses(storeIds[0])
        : warehouseRepo.listWarehouses(),
    purchaseRepo.getPurchaseLinesForInvoices(invoices.map((i) => i.id)),
  ]);
  return enrichPurchasesInMemory(invoices, lines, suppliers, warehouses);
}

async function assertWarehouseBelongsToStore(
  warehouseId: string,
  storeId: string
): Promise<void> {
  const warehouse = await warehouseRepo.getWarehouse(warehouseId);
  if (!warehouse || warehouse.store_id !== storeId || !warehouse.is_active) {
    throw new Error("المخزن لا يتبع الفرع المحدد أو أنه غير نشط");
  }
}

export async function listPurchases(storeId?: string): Promise<PurchaseWithLines[]> {
  const invoices = await purchaseRepo.listPurchases(storeId, "purchase_invoice");
  return enrichPurchases(invoices);
}

export async function listPurchaseDocuments(
  storeId: string | undefined,
  kind: NonNullable<PurchaseInvoice["document_kind"]>
): Promise<PurchaseWithLines[]> {
  const invoices = await purchaseRepo.listPurchases(storeId, kind);
  return enrichPurchases(invoices);
}

export async function getPurchase(id: string): Promise<PurchaseWithLines | null> {
  const invoice = await purchaseRepo.getPurchase(id);
  if (!invoice) return null;
  return enrichPurchase(invoice);
}

/** Matches sales-invoice style: PI-YYYYMMDD-0001 */
export function nextPurchaseInvoiceNumber(
  documentDate: string,
  existingOnDateCount: number
): string {
  const day = documentDate.replace(/-/g, "");
  return `PI-${day}-${String(existingOnDateCount + 1).padStart(4, "0")}`;
}

export async function createDraftPurchase(input: {
  storeId: string;
  warehouseId: string;
  supplierId: string | null;
  /** When omitted/blank, server generates numbered document. */
  invoiceNumber?: string;
  extraCost?: number;
  createdBy: string;
  documentDate?: string;
  documentKind?: NonNullable<PurchaseInvoice["document_kind"]>;
  sourceDocumentId?: string | null;
  documentNotes?: string;
  currency?: string;
  fxRate?: number;
  containerId?: string | null;
}): Promise<PurchaseInvoice> {
  const documentDate = normalizeDocumentDate(input.documentDate ?? todayDocumentDate());
  await assertPeriodOpen(input.storeId, documentDateToOccurredAt(documentDate));
  await assertWarehouseBelongsToStore(input.warehouseId, input.storeId);
  const kind = input.documentKind ?? "purchase_invoice";
  if (kind !== "purchase_request" && !input.supplierId) {
    throw new Error("اختار المورد");
  }
  const currency = (input.currency ?? "EGP").trim().toUpperCase() || "EGP";
  const fxRate = input.fxRate ?? 1;
  if (!(fxRate > 0)) throw new Error("سعر التحويل لازم يكون أكبر من صفر");
  if (currency !== "EGP" && fxRate === 1) {
    // Allow 1 only when operator explicitly set it; imports usually need a real rate.
  }
  const trimmedNumber = input.invoiceNumber?.trim() ?? "";
  const invoiceNumber =
    trimmedNumber ||
    (await purchaseRepo.nextPurchaseDocumentNumber(input.storeId, kind, documentDate));
  const invoice = await purchaseRepo.insertPurchase(
    {
      store_id: input.storeId,
      warehouse_id: input.warehouseId,
      supplier_id: input.supplierId,
      invoice_number: invoiceNumber,
      status: "draft",
      document_kind: kind,
      source_document_id: input.sourceDocumentId ?? null,
      document_notes: input.documentNotes ?? "",
      subtotal: 0,
      extra_cost: Math.max(0, input.extraCost ?? 0),
      tax: 0,
      total: Math.max(0, input.extraCost ?? 0),
      currency,
      fx_rate: fxRate,
      container_id: input.containerId ?? null,
      document_date: documentDate,
      received_at: null,
      cancelled_at: null,
      created_by: input.createdBy,
    },
    []
  );
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "purchase.created",
    entityType: "purchase_invoice",
    entityId: invoice.id,
  });
  return invoice;
}

export type ReorderDraftLineInput = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

export type ReorderSupplierPurchaseHint = {
  supplierId: string;
  status: PurchaseInvoice["status"];
  receivedAt: string | null;
  createdAt: string;
  lines: Array<{ productId: string }>;
};

/** Last received supplier per product (newest first). Skips unknown/removed suppliers. */
export function resolveLastSupplierByProduct(input: {
  productIds: string[];
  purchases: ReorderSupplierPurchaseHint[];
  validSupplierIds: ReadonlySet<string>;
}): Map<string, string> {
  const needed = new Set(input.productIds.filter(Boolean));
  const result = new Map<string, string>();
  if (needed.size === 0) return result;

  const ordered = [...input.purchases]
    .filter((purchase) => purchase.status === "received")
    .sort((a, b) => {
      const aAt = new Date(a.receivedAt ?? a.createdAt).getTime();
      const bAt = new Date(b.receivedAt ?? b.createdAt).getTime();
      return bAt - aAt;
    });

  for (const purchase of ordered) {
    if (!input.validSupplierIds.has(purchase.supplierId)) continue;
    for (const line of purchase.lines) {
      if (!needed.has(line.productId) || result.has(line.productId)) continue;
      result.set(line.productId, purchase.supplierId);
      if (result.size === needed.size) return result;
    }
  }

  return result;
}

/** One draft bucket per warehouse × supplier. Missing history → fallback supplier. */
export function groupReorderLinesByWarehouseAndSupplier(input: {
  lines: ReorderDraftLineInput[];
  lastSupplierByProduct: Map<string, string>;
  fallbackSupplierId: string;
}): Map<string, { warehouseId: string; supplierId: string; lines: ReorderDraftLineInput[] }> {
  const buckets = new Map<
    string,
    { warehouseId: string; supplierId: string; lines: ReorderDraftLineInput[] }
  >();

  for (const line of input.lines) {
    if (!line.productId || !line.warehouseId) continue;
    const qty = Math.max(0, Number(line.quantity) || 0);
    if (qty <= 0) continue;

    const supplierId =
      input.lastSupplierByProduct.get(line.productId) ?? input.fallbackSupplierId;
    const key = `${line.warehouseId}::${supplierId}`;
    const bucket = buckets.get(key) ?? {
      warehouseId: line.warehouseId,
      supplierId,
      lines: [],
    };
    bucket.lines.push({ ...line, quantity: qty });
    buckets.set(key, bucket);
  }

  return buckets;
}

/**
 * Builds one draft invoice per warehouse × last supplier from reorder suggestions.
 * Products without purchase history use the fallback (first) supplier for review.
 */
export async function createDraftPurchasesFromReorder(input: {
  storeId: string;
  createdBy: string;
  lines: ReorderDraftLineInput[];
}): Promise<PurchaseInvoice[]> {
  if (input.lines.length === 0) {
    throw new Error("مفيش أصناف مقترحة لإنشاء المسودة");
  }

  const productIds = [...new Set(input.lines.map((line) => line.productId).filter(Boolean))];
  const warehouseIds = [
    ...new Set(input.lines.map((line) => line.warehouseId).filter(Boolean)),
  ];

  const [suppliers, productMap, purchaseHints] = await Promise.all([
    purchaseRepo.listSuppliers(),
    catalogRepo.getProductsByIds(productIds),
    purchaseRepo.listReceivedSupplierHintsForProducts(productIds),
  ]);

  const fallbackSupplier = suppliers[0];
  if (!fallbackSupplier) {
    throw new Error("أضف مورد أولاً من إدارة الموردين قبل إنشاء مسودة شراء");
  }

  await assertPeriodOpen(input.storeId);
  await Promise.all(
    warehouseIds.map((warehouseId) =>
      assertWarehouseBelongsToStore(warehouseId, input.storeId)
    )
  );

  const lastSupplierByProduct = resolveLastSupplierByProduct({
    productIds,
    validSupplierIds: new Set(suppliers.map((supplier) => supplier.id)),
    purchases: purchaseHints,
  });

  const buckets = groupReorderLinesByWarehouseAndSupplier({
    lines: input.lines,
    lastSupplierByProduct,
    fallbackSupplierId: fallbackSupplier.id,
  });

  if (buckets.size === 0) {
    throw new Error("مفيش كميات صالحة لإنشاء المسودة");
  }

  const stamp = new Date();
  const yymmdd = [
    String(stamp.getFullYear()).slice(2),
    String(stamp.getMonth() + 1).padStart(2, "0"),
    String(stamp.getDate()).padStart(2, "0"),
  ].join("");
  const runId = Math.random().toString(36).slice(2, 6).toUpperCase();
  const orgId = await getOrgId();

  const bucketList = [...buckets.values()];
  const created = await Promise.all(
    bucketList.map(async (bucket, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      const mergedLines = new Map<
        string,
        { productId: string; quantity: number; unitCost: number }
      >();

      for (const line of bucket.lines) {
        const product = productMap.get(line.productId);
        if (!product) continue;
        const unitCost = Math.max(0, product.last_unit_cost ?? 0);
        const existing = mergedLines.get(line.productId);
        if (existing) {
          existing.quantity += line.quantity;
          continue;
        }
        mergedLines.set(line.productId, {
          productId: line.productId,
          quantity: line.quantity,
          unitCost,
        });
      }

      const draftLines = [...mergedLines.values()].map((line) => ({
        product_id: line.productId,
        variant_id: null as string | null,
        quantity: line.quantity,
        unit_cost: line.unitCost,
        line_total: Number((line.quantity * line.unitCost).toFixed(2)),
        landed_unit_cost: null as number | null,
        landed_line_total: null as number | null,
        batch_number: null as string | null,
        production_date: null as string | null,
        expiry_date: null as string | null,
      }));

      const subtotal = draftLines.reduce((sum, line) => sum + line.line_total, 0);
      const invoice = await purchaseRepo.insertPurchase(
        {
          store_id: input.storeId,
          warehouse_id: bucket.warehouseId,
          supplier_id: bucket.supplierId,
          invoice_number: `إعادة-${yymmdd}-${runId}-${suffix}`,
          status: "draft",
          subtotal,
          extra_cost: 0,
          tax: 0,
          total: subtotal,
          document_date: todayDocumentDate(),
          received_at: null,
          cancelled_at: null,
          created_by: input.createdBy,
        },
        draftLines
      );

      await writeAuditLog({
        orgId,
        storeId: input.storeId,
        userId: input.createdBy,
        action: "purchase.created",
        entityType: "purchase_invoice",
        entityId: invoice.id,
      });

      return invoice;
    })
  );

  if (created.length === 0) {
    throw new Error("تعذر إنشاء مسودة الشراء من الاقتراحات");
  }

  return created;
}

export async function addPurchaseLine(input: {
  invoiceId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitCost: number;
  /** Unit the operator entered (base piece or purchase carton). Defaults to base. */
  entryUnit?: MeasurementUnit;
  batchNumber?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
  foreignUnitCost?: number | null;
  sourceLineId?: string | null;
  /** Money discount on the line (after qty×unit). */
  discountAmount?: number;
}): Promise<PurchaseInvoiceLine> {
  const invoice = await purchaseRepo.getPurchase(input.invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status !== "draft") throw new Error("Cannot edit received purchase");

  const product = await catalogRepo.getProduct(input.productId);
  if (!product) throw new Error("Product not found");
  if (input.unitCost < 0) throw new Error("Invalid unit cost");

  const baseUnit = product.base_unit ?? product.unit;
  const purchaseUnit = product.cost_unit ?? baseUnit;
  const factor = productPurchaseFactor(product);
  const converted = convertPurchaseEntryToBase({
    quantity: input.quantity,
    unitCost: input.unitCost,
    entryUnit: input.entryUnit ?? baseUnit,
    baseUnit,
    purchaseUnit,
    unitsPerPurchaseUnit: factor,
  });

  const foreignUnitCost =
    input.foreignUnitCost != null && Number.isFinite(input.foreignUnitCost)
      ? Number(input.foreignUnitCost)
      : null;
  const discountAmount = Math.max(0, input.discountAmount ?? 0);
  const lineTotal = lineTotalAfterDiscount(
    converted.quantity,
    converted.unitCost,
    discountAmount
  );
  const foreignLineTotal =
    foreignUnitCost != null
      ? lineTotalAfterDiscount(converted.quantity, foreignUnitCost, 0)
      : null;

  const lines = await purchaseRepo.getPurchaseLines(input.invoiceId);
  const existing = lines.find(
    (l) =>
      l.product_id === input.productId &&
      l.variant_id === (input.variantId ?? null) &&
      (input.sourceLineId == null || l.source_line_id === input.sourceLineId)
  );

  let line: PurchaseInvoiceLine;
  if (existing && input.sourceLineId == null) {
    const qty = existing.quantity + converted.quantity;
    const blendedCost =
      qty > 0
        ? Number(
            ((existing.quantity * existing.unit_cost + converted.quantity * converted.unitCost) / qty).toFixed(4)
          )
        : converted.unitCost;
    const mergedDiscount = Number(
      ((existing.discount_amount ?? 0) + discountAmount).toFixed(2)
    );
    line = (await purchaseRepo.updatePurchaseLine(existing.id, {
      quantity: qty,
      unit_cost: blendedCost,
      discount_amount: mergedDiscount,
      line_total: lineTotalAfterDiscount(qty, blendedCost, mergedDiscount),
      landed_unit_cost: null,
      landed_line_total: null,
      batch_number: input.batchNumber ?? null,
      production_date: input.productionDate ?? null,
      expiry_date: input.expiryDate ?? null,
      ...(foreignUnitCost != null
        ? {
            foreign_unit_cost: foreignUnitCost,
            foreign_line_total: Number((foreignUnitCost * qty).toFixed(2)),
          }
        : {}),
    }))!;
  } else {
    line = await purchaseRepo.addPurchaseLine({
      invoice_id: input.invoiceId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: converted.quantity,
      unit_cost: converted.unitCost,
      discount_amount: discountAmount,
      line_total: lineTotal,
      landed_unit_cost: null,
      landed_line_total: null,
      batch_number: input.batchNumber ?? null,
      production_date: input.productionDate ?? null,
      expiry_date: input.expiryDate ?? null,
      source_line_id: input.sourceLineId ?? null,
      foreign_unit_cost: foreignUnitCost,
      foreign_line_total: foreignLineTotal,
    });
  }
  await purchaseRepo.recalcPurchaseTotals(input.invoiceId);
  return line;
}

export async function removePurchaseLine(lineId: string): Promise<void> {
  const line = await purchaseRepo.getPurchaseLine(lineId);
  if (!line) return;
  const invoice = await purchaseRepo.getPurchase(line.invoice_id);
  if (!invoice || invoice.status !== "draft") return;
  await purchaseRepo.deletePurchaseLine(lineId);
  await purchaseRepo.recalcPurchaseTotals(line.invoice_id);
}

/** Slim receive result for the hot path — UI refreshes list separately. */
export type ReceivePurchaseResult = {
  id: string;
  invoice_number: string;
  status: "received";
  total: number;
  store_id: string;
  supplier_id: string;
  document_date: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
};

export async function receivePurchase(
  invoiceId: string,
  userId: string,
  options?: {
    amountPaid?: number;
    paymentMethod?: PaymentMethod;
  }
): Promise<ReceivePurchaseResult> {
  const amountPaid = options?.amountPaid ?? 0;
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new Error("مبلغ الدفعة لازم يكون صفر أو أكبر");
  }
  if (amountPaid > 0) {
    const method = options?.paymentMethod ?? "cash";
    if (method === "credit") {
      throw new Error("Cannot record a supplier payment as credit");
    }
  }

  const preventNegativeStock = await isFeatureEnabled("prevent_negative_stock");
  const received = await purchaseRepo.receivePurchaseAtomic({
    invoiceId,
    userId,
    amountPaid,
    paymentMethod: amountPaid > 0 ? options?.paymentMethod ?? "cash" : undefined,
    preventNegativeStock,
  });

  const paymentMethod = (options?.paymentMethod ?? "cash") as PaymentMethod;
  const documentDate = normalizeDocumentDate(
    received.document_date ?? todayDocumentDate()
  );

  // Soft-fail GL — never block the operator on journal posting.
  after(() => {
    void (async () => {
      try {
        const { safePostPurchaseJournal } = await import(
          "@/modules/accounting/services/gl-posting.service"
        );
        await safePostPurchaseJournal({
          purchaseId: invoiceId,
          storeId: received.store_id,
          total: received.total,
          amountPaid,
          paymentMethod,
          entryDate: documentDate,
          createdBy: userId,
          memo: `استلام شراء ${received.invoice_number}`,
        });
      } catch (error) {
        console.error("[purchase] deferred GL post failed", error);
      }
    })();
  });

  return {
    id: received.id,
    invoice_number: received.invoice_number,
    status: "received",
    total: received.total,
    store_id: received.store_id,
    supplier_id: received.supplier_id ?? "",
    document_date: documentDate,
    amountPaid,
    paymentMethod,
  };
}

export async function updatePurchaseLine(input: {
  lineId: string;
  quantity: number;
  unitCost: number;
  discountAmount?: number;
  batchNumber?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
}): Promise<PurchaseInvoiceLine> {
  if (input.quantity <= 0) throw new Error("Invalid quantity");
  if (input.unitCost < 0) throw new Error("Invalid unit cost");
  const line = await purchaseRepo.getPurchaseLine(input.lineId);
  if (!line) throw new Error("Line not found");
  const invoice = await purchaseRepo.getPurchase(line.invoice_id);
  if (!invoice || invoice.status !== "draft") {
    throw new Error("Cannot edit received purchase");
  }
  const discountAmount = Math.max(
    0,
    input.discountAmount !== undefined ? input.discountAmount : (line.discount_amount ?? 0)
  );
  const updated = await purchaseRepo.updatePurchaseLine(input.lineId, {
    quantity: input.quantity,
    unit_cost: input.unitCost,
    discount_amount: discountAmount,
    line_total: lineTotalAfterDiscount(input.quantity, input.unitCost, discountAmount),
    landed_unit_cost: null,
    landed_line_total: null,
    batch_number: input.batchNumber ?? null,
    production_date: input.productionDate ?? null,
    expiry_date: input.expiryDate ?? null,
  });
  if (!updated) throw new Error("Failed to update line");
  await purchaseRepo.recalcPurchaseTotals(line.invoice_id);
  return updated;
}

export async function updateDraftPurchase(
  invoiceId: string,
  input: {
    supplierId?: string | null;
    invoiceNumber?: string;
    extraCost?: number;
    documentDate?: string;
    documentNotes?: string;
    currency?: string;
    fxRate?: number;
  }
): Promise<PurchaseInvoice> {
  const invoice = await purchaseRepo.getPurchase(invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  const kind = invoice.document_kind ?? "purchase_invoice";
  const prOpen =
    kind === "purchase_request" &&
    (invoice.status === "draft" ||
      invoice.status === "submitted" ||
      invoice.status === "approved");
  if (invoice.status !== "draft" && !prOpen) {
    throw new Error("Cannot edit received purchase");
  }
  if (invoice.status !== "draft" && prOpen) {
    if (
      input.invoiceNumber !== undefined ||
      input.extraCost !== undefined ||
      input.documentDate !== undefined ||
      input.documentNotes !== undefined ||
      input.currency !== undefined ||
      input.fxRate !== undefined
    ) {
      throw new Error("Cannot edit received purchase");
    }
  }
  const documentDate =
    input.documentDate !== undefined
      ? normalizeDocumentDate(input.documentDate)
      : undefined;
  if (documentDate) {
    await assertPeriodOpen(invoice.store_id, documentDateToOccurredAt(documentDate));
  }
  if (kind !== "purchase_request" && input.supplierId === null) {
    throw new Error("اختار المورد");
  }
  const currency =
    input.currency !== undefined
      ? input.currency.trim().toUpperCase() || "EGP"
      : undefined;
  const fxRate = input.fxRate !== undefined ? Number(input.fxRate) : undefined;
  if (fxRate !== undefined && !(fxRate > 0)) {
    throw new Error("سعر التحويل لازم يكون أكبر من صفر");
  }
  const updated = await purchaseRepo.updatePurchase(invoiceId, {
    ...(input.supplierId !== undefined ? { supplier_id: input.supplierId } : {}),
    ...(input.invoiceNumber !== undefined ? { invoice_number: input.invoiceNumber } : {}),
    ...(input.extraCost !== undefined ? { extra_cost: Math.max(0, input.extraCost) } : {}),
    ...(documentDate !== undefined ? { document_date: documentDate } : {}),
    ...(input.documentNotes !== undefined
      ? { document_notes: input.documentNotes.trim().slice(0, 500) }
      : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(fxRate !== undefined ? { fx_rate: fxRate } : {}),
  });
  if (!updated) throw new Error("Failed to update purchase");
  await purchaseRepo.recalcPurchaseTotals(invoiceId);
  const refreshed = await purchaseRepo.getPurchase(invoiceId);
  if (!refreshed) throw new Error("Failed to update purchase");
  return refreshed;
}

export async function deleteDraftPurchase(invoiceId: string, userId: string): Promise<void> {
  const invoice = await purchaseRepo.getPurchase(invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status !== "draft") throw new Error("Only draft purchases can be deleted");
  await purchaseRepo.deletePurchaseLinesForInvoice(invoiceId);
  await purchaseRepo.deletePurchase(invoiceId);
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: invoice.store_id,
    userId,
    action: "purchase.deleted",
    entityType: "purchase_invoice",
    entityId: invoiceId,
  });
}

/**
 * Reverse stock from a received purchase and reopen it as draft
 * so the operator can fix lines and receive again.
 * Legacy `cancelled` invoices stay cancelled (not reopened).
 */
export async function voidReceivedPurchase(
  invoiceId: string,
  userId: string
): Promise<PurchaseInvoice> {
  const invoice = await purchaseRepo.getPurchase(invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status === "draft") {
    throw new Error("Delete draft purchases instead of voiding");
  }
  if (invoice.status === "cancelled") throw new Error("Purchase already cancelled");
  if (invoice.status !== "received") throw new Error("Cannot void purchase in this status");

  await assertPeriodOpen(invoice.store_id);
  const lines = await purchaseRepo.getPurchaseLines(invoiceId);
  const invoiceBatches = await inventoryRepo.listInventoryBatchesForPurchaseInvoice(invoiceId);
  const batchesByProduct = new Map<string, typeof invoiceBatches>();
  for (const batch of invoiceBatches) {
    const key = `${batch.product_id}:${batch.variant_id ?? ""}`;
    const list = batchesByProduct.get(key) ?? [];
    list.push(batch);
    batchesByProduct.set(key, list);
  }

  for (const line of lines) {
    const lineKey = `${line.product_id}:${line.variant_id ?? ""}`;
    const linkedBatches = batchesByProduct.get(lineKey) ?? [];
    const remainingBatches = linkedBatches.filter((b) => b.remaining_quantity > 0);

    if (remainingBatches.length > 0) {
      for (const batch of remainingBatches) {
        await adjustStock({
          storeId: invoice.store_id,
          warehouseId: invoice.warehouse_id,
          productId: line.product_id,
          variantId: line.variant_id,
          quantityDelta: -batch.remaining_quantity,
          movementType: "purchase",
          referenceType: "purchase_invoice",
          referenceId: invoiceId,
          createdBy: userId,
          reason: "reopen purchase as draft",
          batch: {
            batchNumber: batch.batch_number,
            sourceType: "purchase",
            sourceDocumentId: invoice.id,
            purchaseInvoiceId: invoice.id,
          },
        });
      }
    } else {
      // Line never created a batch (e.g. track_inventory was off at receive).
      // Reverse whatever stock still exists, without inventing a missing batch number.
      const current = await getStockLevel(
        invoice.store_id,
        invoice.warehouse_id,
        line.product_id,
        line.variant_id
      );
      const qtyToReverse = Math.min(current, line.quantity);
      if (qtyToReverse > 0) {
        await adjustStock({
          storeId: invoice.store_id,
          warehouseId: invoice.warehouse_id,
          productId: line.product_id,
          variantId: line.variant_id,
          quantityDelta: -qtyToReverse,
          movementType: "purchase",
          referenceType: "purchase_invoice",
          referenceId: invoiceId,
          createdBy: userId,
          reason: "reopen purchase as draft",
        });
      }
    }

    await purchaseRepo.updatePurchaseLine(line.id, {
      landed_unit_cost: null,
      landed_line_total: null,
    });
  }

  const updated = await purchaseRepo.updatePurchase(invoiceId, {
    status: "draft",
    received_at: null,
    cancelled_at: null,
  });
  if (!updated) throw new Error("Failed to reopen purchase");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: invoice.store_id,
    userId,
    action: "purchase.reopened",
    entityType: "purchase_invoice",
    entityId: invoiceId,
    metadata: { previousStatus: "received", lineCount: lines.length },
  });
  return updated;
}

export async function listSuppliers() {
  return purchaseRepo.listSuppliers();
}

export async function transitionPurchaseDocument(input: {
  invoiceId: string;
  from: PurchaseInvoice["status"];
  to: PurchaseInvoice["status"];
}): Promise<PurchaseWithLines> {
  const current = await getPurchase(input.invoiceId);
  if (!current) throw new Error("المستند غير موجود");
  if (current.status !== input.from) throw new Error("حالة المستند لا تسمح بهذا الإجراء");
  const kind = current.document_kind ?? "purchase_invoice";
  const allowed: Partial<
    Record<
      NonNullable<PurchaseInvoice["document_kind"]>,
      Partial<Record<PurchaseInvoice["status"], PurchaseInvoice["status"][]>>
    >
  > = {
    purchase_request: { draft: ["submitted"], submitted: ["approved", "rejected"] },
    purchase_order: { draft: ["sent"] },
  };
  const next = allowed[kind]?.[input.from] ?? [];
  if (!next.includes(input.to)) {
    throw new Error("حالة المستند لا تسمح بهذا الإجراء");
  }
  const updated = await purchaseRepo.updatePurchase(input.invoiceId, { status: input.to });
  if (!updated) throw new Error("تعذر تحديث المستند");
  const detail = await getPurchase(updated.id);
  if (!detail) throw new Error("المستند غير موجود");
  return detail;
}

export { remainingPurchaseLineQty } from "@/modules/purchases/lib/remaining-qty";

export async function allocatedPurchaseLineQty(poLineId: string): Promise<number> {
  const db = await (await import("@/lib/repositories/client")).getDb();
  const { data, error } = await db
    .from("purchase_invoice_lines")
    .select("quantity, purchase_invoices!inner(status, document_kind)")
    .eq("source_line_id" as never, poLineId);
  if (error) throw new Error(error.message);
  let sum = 0;
  for (const row of data ?? []) {
    const parent = row.purchase_invoices as
      | { status: string; document_kind: string }
      | { status: string; document_kind: string }[]
      | null;
    const doc = Array.isArray(parent) ? parent[0] : parent;
    if (!doc || doc.status === "cancelled") continue;
    if (doc.document_kind !== "purchase_invoice") continue;
    sum += Number(row.quantity ?? 0);
  }
  return sum;
}

export async function convertPurchaseDocument(input: {
  sourceId: string;
  createdBy: string;
  targetKind: "purchase_order" | "purchase_invoice" | "purchase_return";
  fromStatus: PurchaseInvoice["status"];
  lockStatus?: PurchaseInvoice["status"];
  supplierId?: string | null;
  lines?: Array<{ sourceLineId: string; quantity: number }>;
}): Promise<PurchaseWithLines> {
  const source = await getPurchase(input.sourceId);
  if (!source) throw new Error("المستند غير موجود");
  if (source.status !== input.fromStatus) throw new Error("حالة المستند لا تسمح بالتحويل");

  const supplierId = input.supplierId ?? source.supplier_id;
  if (!supplierId) {
    throw new Error("اختار المورد");
  }

  const draft = await createDraftPurchase({
    storeId: source.store_id,
    warehouseId: source.warehouse_id,
    supplierId,
    createdBy: input.createdBy,
    documentKind: input.targetKind,
    sourceDocumentId: source.id,
    currency: source.currency,
    fxRate: source.fx_rate,
  });

  const requested = input.lines?.length
    ? input.lines
    : source.lines.map((line) => ({ sourceLineId: line.id, quantity: line.quantity }));

  for (const req of requested) {
    const sourceLine = source.lines.find((line) => line.id === req.sourceLineId);
    if (!sourceLine) throw new Error("سطر غير موجود على المستند المصدر");
    if (input.targetKind === "purchase_invoice") {
      const allocated = await allocatedPurchaseLineQty(sourceLine.id);
      const remaining = remainingPurchaseLineQty(sourceLine.quantity, allocated);
      if (req.quantity > remaining) {
        throw new Error("الكمية أكبر من المتبقي على أمر التوريد");
      }
    }
    if (req.quantity <= 0) continue;
    const sourceDiscount = sourceLine.discount_amount ?? 0;
    const discountAmount =
      sourceLine.quantity > 0
        ? Number(((sourceDiscount * req.quantity) / sourceLine.quantity).toFixed(2))
        : 0;
    await purchaseRepo.addPurchaseLine({
      invoice_id: draft.id,
      product_id: sourceLine.product_id,
      variant_id: sourceLine.variant_id,
      quantity: req.quantity,
      unit_cost: sourceLine.unit_cost,
      discount_amount: discountAmount,
      line_total: lineTotalAfterDiscount(
        req.quantity,
        sourceLine.unit_cost,
        discountAmount
      ),
      source_line_id: sourceLine.id,
      foreign_unit_cost: sourceLine.foreign_unit_cost ?? null,
      foreign_line_total:
        sourceLine.foreign_unit_cost != null
          ? Number((req.quantity * sourceLine.foreign_unit_cost).toFixed(2))
          : null,
    });
  }

  if (input.lockStatus) {
    if (input.targetKind === "purchase_invoice") {
      let remainingTotal = 0;
      for (const line of source.lines) {
        const allocated = await allocatedPurchaseLineQty(line.id);
        remainingTotal += remainingPurchaseLineQty(line.quantity, allocated);
      }
      await purchaseRepo.updatePurchase(source.id, {
        status: remainingTotal <= 0 ? "invoiced" : "partial_invoiced",
      });
    } else {
      await purchaseRepo.updatePurchase(source.id, { status: input.lockStatus });
    }
  }

  const detail = await getPurchase(draft.id);
  if (!detail) throw new Error("تعذر إنشاء المستند");
  return detail;
}

export async function postPurchaseReturn(invoiceId: string, userId: string): Promise<PurchaseWithLines> {
  const current = await getPurchase(invoiceId);
  if (!current || current.document_kind !== "purchase_return") {
    throw new Error("مرتجع غير موجود");
  }
  const flags = await isFeatureEnabled("prevent_negative_stock");
  const { error } = await (await import("@/lib/repositories/client")).callRpc(
    "post_purchase_return",
    {
      p_invoice_id: invoiceId,
      p_user_id: userId,
      p_prevent_negative: flags,
    }
  );
  if (error) throw new Error(error.message);
  const posted = await getPurchase(invoiceId);
  if (!posted) throw new Error("تعذر ترحيل المرتجع");

  const documentDate = normalizeDocumentDate(
    posted.document_date ?? todayDocumentDate()
  );
  after(() => {
    void (async () => {
      try {
        const { safePostPurchaseReturnJournal } = await import(
          "@/modules/accounting/services/gl-posting.service"
        );
        await safePostPurchaseReturnJournal({
          purchaseReturnId: posted.id,
          storeId: posted.store_id,
          total: posted.total,
          entryDate: documentDate,
          createdBy: userId,
          memo: `مرتجع مشتريات ${posted.invoice_number}`,
        });
      } catch (error) {
        console.error("[purchase-return] deferred GL post failed", error);
      }
    })();
  });

  return posted;
}
