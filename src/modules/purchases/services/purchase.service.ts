import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import * as inventoryRepo from "@/lib/repositories/inventory.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { adjustStock, getStockLevel } from "@/lib/services/inventory-movement.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { calculateExpiryDate, toIsoDate } from "@/lib/inventory/expiry";
import { convertPurchaseEntryToBase, productPurchaseFactor } from "@/lib/units";
import type { MeasurementUnit, PaymentMethod, PurchaseInvoice, PurchaseInvoiceLine } from "@/lib/types";
import { createSupplierPayment } from "@/modules/suppliers/services/supplier.service";

export interface PurchaseWithLines extends PurchaseInvoice {
  lines: PurchaseInvoiceLine[];
  supplierName: string;
  warehouseName: string;
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
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w.name]));
  const linesByInvoice = new Map<string, PurchaseInvoiceLine[]>();
  for (const line of lines) {
    const list = linesByInvoice.get(line.invoice_id) ?? [];
    list.push(line);
    linesByInvoice.set(line.invoice_id, list);
  }
  return invoices.map((invoice) => ({
    ...invoice,
    lines: linesByInvoice.get(invoice.id) ?? [],
    supplierName: supplierMap.get(invoice.supplier_id) ?? "Unknown",
    warehouseName: warehouseMap.get(invoice.warehouse_id) ?? "Unknown warehouse",
  }));
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
    throw new Error("Warehouse does not belong to the selected store");
  }
}

export async function listPurchases(storeId?: string): Promise<PurchaseWithLines[]> {
  const invoices = await purchaseRepo.listPurchases(storeId);
  return enrichPurchases(invoices);
}

export async function getPurchase(id: string): Promise<PurchaseWithLines | null> {
  const invoice = await purchaseRepo.getPurchase(id);
  if (!invoice) return null;
  return enrichPurchase(invoice);
}

export async function createDraftPurchase(input: {
  storeId: string;
  warehouseId: string;
  supplierId: string;
  invoiceNumber: string;
  extraCost?: number;
  createdBy: string;
}): Promise<PurchaseInvoice> {
  await assertPeriodOpen(input.storeId);
  await assertWarehouseBelongsToStore(input.warehouseId, input.storeId);
  const invoice = await purchaseRepo.insertPurchase(
    {
      store_id: input.storeId,
      warehouse_id: input.warehouseId,
      supplier_id: input.supplierId,
      invoice_number: input.invoiceNumber,
      status: "draft",
      subtotal: 0,
      extra_cost: Math.max(0, input.extraCost ?? 0),
      tax: 0,
      total: Math.max(0, input.extraCost ?? 0),
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
}): Promise<PurchaseInvoiceLine> {
  const invoice = await purchaseRepo.getPurchase(input.invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status !== "draft") throw new Error("Cannot edit received purchase");

  const product = await catalogRepo.getProduct(input.productId);
  if (!product) throw new Error("Product not found");

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

  const lines = await purchaseRepo.getPurchaseLines(input.invoiceId);
  const existing = lines.find(
    (l) =>
      l.product_id === input.productId &&
      l.variant_id === (input.variantId ?? null)
  );

  let line: PurchaseInvoiceLine;
  if (existing) {
    const qty = existing.quantity + converted.quantity;
    const blendedCost =
      qty > 0
        ? Number(
            ((existing.quantity * existing.unit_cost + converted.quantity * converted.unitCost) / qty).toFixed(4)
          )
        : converted.unitCost;
    line = (await purchaseRepo.updatePurchaseLine(existing.id, {
      quantity: qty,
      unit_cost: blendedCost,
      line_total: Number((qty * blendedCost).toFixed(2)),
      landed_unit_cost: null,
      landed_line_total: null,
      batch_number: input.batchNumber ?? null,
      production_date: input.productionDate ?? null,
      expiry_date: input.expiryDate ?? null,
    }))!;
  } else {
    line = await purchaseRepo.addPurchaseLine({
      invoice_id: input.invoiceId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: converted.quantity,
      unit_cost: converted.unitCost,
      line_total: converted.lineTotal,
      landed_unit_cost: null,
      landed_line_total: null,
      batch_number: input.batchNumber ?? null,
      production_date: input.productionDate ?? null,
      expiry_date: input.expiryDate ?? null,
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

export async function receivePurchase(
  invoiceId: string,
  userId: string,
  options?: {
    amountPaid?: number;
    paymentMethod?: PaymentMethod;
  }
): Promise<PurchaseInvoice> {
  const invoice = await purchaseRepo.getPurchase(invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status === "received") throw new Error("Already received");
  if (invoice.status !== "draft") throw new Error("Only draft purchases can be received");
  await assertPeriodOpen(invoice.store_id);

  const amountPaid = options?.amountPaid ?? 0;
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new Error("مبلغ الدفعة لازم يكون صفر أو أكبر");
  }
  if (amountPaid > invoice.total) {
    throw new Error("مبلغ الدفعة لا يمكن أن يتجاوز إجمالي الفاتورة");
  }
  if (amountPaid > 0) {
    const method = options?.paymentMethod ?? "cash";
    if (method === "credit") {
      throw new Error("Cannot record a supplier payment as credit");
    }
  }

  const lines = await purchaseRepo.getPurchaseLines(invoiceId);
  if (lines.length === 0) throw new Error("Add at least one line");
  const allocations = allocateLandedCosts(lines, invoice.extra_cost);

  for (const line of lines) {
    const landed = allocations.get(line.id) ?? {
      landedUnitCost: line.unit_cost,
      landedLineTotal: line.line_total,
    };
    await purchaseRepo.updatePurchaseLine(line.id, {
      landed_unit_cost: landed.landedUnitCost,
      landed_line_total: landed.landedLineTotal,
    });
    const product = await catalogRepo.getProduct(line.product_id);

    await adjustStock({
      storeId: invoice.store_id,
      warehouseId: invoice.warehouse_id,
      productId: line.product_id,
      variantId: line.variant_id,
      quantityDelta: line.quantity,
      movementType: "purchase",
      referenceType: "purchase_invoice",
      referenceId: invoiceId,
      createdBy: userId,
      batch: {
        batchNumber:
          line.batch_number ??
          `${invoice.invoice_number}-${line.product_id.slice(0, 6)}-${line.id.slice(0, 6)}`,
        productionDate: toIsoDate(line.production_date),
        expiryDate:
          toIsoDate(line.expiry_date) ??
          calculateExpiryDate(
            toIsoDate(line.production_date),
            product?.shelf_life_value ?? 0,
            product?.shelf_life_unit ?? "days"
          ),
        shelfLifeValue: product?.shelf_life_value ?? 0,
        shelfLifeUnit: product?.shelf_life_unit ?? "days",
        receivedDate: new Date().toISOString().slice(0, 10),
        supplierId: invoice.supplier_id,
        purchaseInvoiceId: invoice.id,
        sourceType: "purchase",
        sourceDocumentId: invoice.id,
      },
    });

    if (product) {
      await catalogRepo.updateProduct(line.product_id, {
        last_unit_cost: landed.landedUnitCost,
        cost_unit: product.cost_unit ?? product.unit,
      });
    }
  }

  const updated = await purchaseRepo.updatePurchase(invoiceId, {
    status: "received",
    received_at: new Date().toISOString(),
  });
  if (!updated) throw new Error("Failed to update purchase");

  if (amountPaid > 0) {
    await createSupplierPayment({
      storeId: invoice.store_id,
      supplierId: invoice.supplier_id,
      amount: amountPaid,
      paymentMethod: options?.paymentMethod ?? "cash",
      reference: invoice.invoice_number,
      notes: `دفعة مع استلام فاتورة ${invoice.invoice_number}`,
      createdBy: userId,
    });
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: invoice.store_id,
    userId,
    action: "purchase.received",
    entityType: "purchase_invoice",
    entityId: invoiceId,
    metadata: {
      total: updated.total,
      lineCount: lines.length,
      amountPaid,
    },
  });

  return updated;
}

export async function updatePurchaseLine(input: {
  lineId: string;
  quantity: number;
  unitCost: number;
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
  const updated = await purchaseRepo.updatePurchaseLine(input.lineId, {
    quantity: input.quantity,
    unit_cost: input.unitCost,
    line_total: input.quantity * input.unitCost,
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
  input: { supplierId?: string; invoiceNumber?: string; extraCost?: number }
): Promise<PurchaseInvoice> {
  const invoice = await purchaseRepo.getPurchase(invoiceId);
  if (!invoice) throw new Error("Purchase not found");
  if (invoice.status !== "draft") throw new Error("Cannot edit received purchase");
  const updated = await purchaseRepo.updatePurchase(invoiceId, {
    ...(input.supplierId !== undefined ? { supplier_id: input.supplierId } : {}),
    ...(input.invoiceNumber !== undefined ? { invoice_number: input.invoiceNumber } : {}),
    ...(input.extraCost !== undefined ? { extra_cost: Math.max(0, input.extraCost) } : {}),
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
