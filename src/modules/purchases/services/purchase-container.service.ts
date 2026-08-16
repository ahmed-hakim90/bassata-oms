import * as importRepo from "@/lib/repositories/purchase-import.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as warehouseRepo from "@/lib/repositories/warehouse.repository";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertPeriodOpen } from "@/lib/services/period-lock.service";
import { todayDocumentDate } from "@/lib/document-date";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import {
  type PurchaseContainerStatus,
  PURCHASE_CONTAINER_STATUSES,
} from "@/modules/purchases/lib/import-constants";
import { foreignLineToBase } from "@/modules/purchases/lib/import-fx";
import {
  addPurchaseLine,
  createDraftPurchase,
  getPurchase,
  receivePurchase,
  type PurchaseWithLines,
} from "@/modules/purchases/services/purchase.service";
import { syncCertificateLandedCosts } from "@/modules/purchases/services/customs-certificate.service";

export type ContainerWithLines = importRepo.PurchaseContainerRow & {
  lines: importRepo.PurchaseContainerLineRow[];
  purchaseOrderNumber: string;
  certificateNumber: string | null;
};

async function assertImportsEnabled(): Promise<void> {
  if (!(await isFeatureEnabled("purchase_imports"))) {
    throw new Error("استيراد الحاويات مش مفعّل — فعّله من إعدادات النظام");
  }
}

function assertStatus(status: string): asserts status is PurchaseContainerStatus {
  if (!(PURCHASE_CONTAINER_STATUSES as readonly string[]).includes(status)) {
    throw new Error("حالة الحاوية غير صحيحة");
  }
}

export async function listContainersWithLines(options?: {
  storeId?: string;
  purchaseOrderId?: string;
}): Promise<ContainerWithLines[]> {
  await assertImportsEnabled();
  const containers = await importRepo.listContainers(options);
  const lines = await importRepo.listContainerLines(containers.map((c) => c.id));
  const linesByContainer = new Map<string, importRepo.PurchaseContainerLineRow[]>();
  for (const line of lines) {
    const list = linesByContainer.get(line.container_id) ?? [];
    list.push(line);
    linesByContainer.set(line.container_id, list);
  }

  const poIds = [...new Set(containers.map((c) => c.purchase_order_id))];
  const certIds = [
    ...new Set(
      containers
        .map((c) => c.customs_certificate_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const poNumbers = new Map<string, string>();
  for (const poId of poIds) {
    const po = await purchaseRepo.getPurchase(poId);
    if (po) poNumbers.set(poId, po.invoice_number);
  }
  const certNumbers = new Map<string, string>();
  for (const certId of certIds) {
    const cert = await importRepo.getCertificate(certId);
    if (cert) certNumbers.set(certId, cert.certificate_number);
  }

  return containers.map((container) => ({
    ...container,
    lines: linesByContainer.get(container.id) ?? [],
    purchaseOrderNumber: poNumbers.get(container.purchase_order_id) ?? "—",
    certificateNumber: container.customs_certificate_id
      ? (certNumbers.get(container.customs_certificate_id) ?? null)
      : null,
  }));
}

export async function getContainerWithLines(
  containerId: string
): Promise<ContainerWithLines | null> {
  await assertImportsEnabled();
  const container = await importRepo.getContainer(containerId);
  if (!container) return null;
  const [list] = await Promise.all([
    listContainersWithLines({ purchaseOrderId: container.purchase_order_id }),
  ]);
  return list.find((c) => c.id === containerId) ?? null;
}

export async function createContainer(input: {
  purchaseOrderId: string;
  containerNumber: string;
  warehouseId?: string;
  notes?: string;
  lines: { sourceLineId: string; quantity: number }[];
  createdBy: string;
}): Promise<ContainerWithLines> {
  await assertImportsEnabled();
  const po = await purchaseRepo.getPurchase(input.purchaseOrderId);
  if (!po) throw new Error("أمر التوريد غير موجود");
  if ((po.document_kind ?? "purchase_invoice") !== "purchase_order") {
    throw new Error("الحاوية بتتسجل على أمر توريد فقط");
  }
  if (po.status === "cancelled") throw new Error("أمر التوريد ملغي");

  const warehouseId = input.warehouseId ?? po.warehouse_id;
  const warehouse = await warehouseRepo.getWarehouse(warehouseId);
  if (!warehouse || warehouse.store_id !== po.store_id) {
    throw new Error("المخزن مش تابع لنفس الفرع");
  }

  const number = input.containerNumber.trim();
  if (!number) throw new Error("رقم الحاوية مطلوب");

  const poLines = await purchaseRepo.getPurchaseLines(po.id);
  const poLineMap = new Map(poLines.map((line) => [line.id, line]));
  const allocated = await importRepo.sumContainerQtyBySourceLine(po.id);
  const nextLines: Omit<
    importRepo.PurchaseContainerLineRow,
    "id" | "created_at" | "container_id"
  >[] = [];

  for (const line of input.lines) {
    const qty = Number(line.quantity);
    if (!(qty > 0)) continue;
    const poLine = poLineMap.get(line.sourceLineId);
    if (!poLine) throw new Error("سطر أمر التوريد غير موجود");
    const already = allocated.get(line.sourceLineId) ?? 0;
    if (already + qty > poLine.quantity + 1e-9) {
      throw new Error(`كمية الحاوية أكبر من المتبقي لسطر ${poLine.product_id.slice(0, 8)}`);
    }
    nextLines.push({
      source_line_id: line.sourceLineId,
      product_id: poLine.product_id,
      variant_id: poLine.variant_id,
      quantity: qty,
    });
  }
  if (nextLines.length === 0) throw new Error("اختار أصناف للحاوية");

  const container = await importRepo.insertContainer({
    store_id: po.store_id,
    warehouse_id: warehouseId,
    purchase_order_id: po.id,
    customs_certificate_id: null,
    container_number: number,
    status: "planned",
    shipped_at: null,
    arrived_port_at: null,
    received_at: null,
    notes: (input.notes ?? "").trim().slice(0, 500),
    created_by: input.createdBy,
  });
  await importRepo.replaceContainerLines(container.id, nextLines);

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: po.store_id,
    userId: input.createdBy,
    action: "purchase_container.created",
    entityType: "purchase_container",
    entityId: container.id,
  });

  const full = await getContainerWithLines(container.id);
  if (!full) throw new Error("فشل إنشاء الحاوية");
  return full;
}

export async function updateContainerStatus(input: {
  containerId: string;
  status: PurchaseContainerStatus;
  userId: string;
  shippedAt?: string | null;
  arrivedPortAt?: string | null;
}): Promise<ContainerWithLines> {
  await assertImportsEnabled();
  assertStatus(input.status);
  const container = await importRepo.getContainer(input.containerId);
  if (!container) throw new Error("الحاوية غير موجودة");
  if (container.status === "received") {
    throw new Error("الحاوية مستلمة — مينفعش تغيير الحالة");
  }
  if (container.status === "cancelled") {
    throw new Error("الحاوية ملغاة");
  }
  if (input.status === "received") {
    throw new Error("استلم الحاوية من زر الاستلام");
  }

  const patch: Parameters<typeof importRepo.updateContainer>[1] = {
    status: input.status,
  };
  if (input.shippedAt !== undefined) patch.shipped_at = input.shippedAt;
  if (input.arrivedPortAt !== undefined) patch.arrived_port_at = input.arrivedPortAt;
  if (input.status === "shipped" && !container.shipped_at && !input.shippedAt) {
    patch.shipped_at = todayDocumentDate();
  }
  if (input.status === "at_port" && !container.arrived_port_at && !input.arrivedPortAt) {
    patch.arrived_port_at = todayDocumentDate();
  }

  const updated = await importRepo.updateContainer(container.id, patch);
  if (!updated) throw new Error("فشل تحديث الحاوية");

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: container.store_id,
    userId: input.userId,
    action: "purchase_container.status",
    entityType: "purchase_container",
    entityId: container.id,
    metadata: { status: input.status },
  });

  const full = await getContainerWithLines(container.id);
  if (!full) throw new Error("الحاوية غير موجودة");
  return full;
}

export async function attachContainerToCertificate(input: {
  containerId: string;
  certificateId: string | null;
  userId: string;
}): Promise<ContainerWithLines> {
  await assertImportsEnabled();
  const container = await importRepo.getContainer(input.containerId);
  if (!container) throw new Error("الحاوية غير موجودة");
  if (container.status === "cancelled") throw new Error("الحاوية ملغاة");

  if (input.certificateId) {
    const cert = await importRepo.getCertificate(input.certificateId);
    if (!cert) throw new Error("الشهادة الجمركية غير موجودة");
    if (cert.status === "closed") throw new Error("الشهادة مقفولة");
    if (cert.store_id !== container.store_id) {
      throw new Error("الشهادة مش لنفس الفرع");
    }
  }

  await importRepo.updateContainer(container.id, {
    customs_certificate_id: input.certificateId,
  });

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: container.store_id,
    userId: input.userId,
    action: "purchase_container.certificate",
    entityType: "purchase_container",
    entityId: container.id,
    metadata: { certificateId: input.certificateId },
  });

  const full = await getContainerWithLines(container.id);
  if (!full) throw new Error("الحاوية غير موجودة");
  return full;
}

/**
 * Create purchase invoice from container lines (FX → EGP) and receive stock.
 */
export async function receiveContainer(input: {
  containerId: string;
  userId: string;
  amountPaid?: number;
  paymentMethod?: "cash" | "card" | "wallet" | "other";
}): Promise<{ container: ContainerWithLines; purchase: PurchaseWithLines }> {
  await assertImportsEnabled();
  const container = await importRepo.getContainer(input.containerId);
  if (!container) throw new Error("الحاوية غير موجودة");
  if (container.status === "cancelled") throw new Error("الحاوية ملغاة");
  if (container.status === "received") throw new Error("الحاوية مستلمة قبل كده");

  const lines = await importRepo.listContainerLines([container.id]);
  if (lines.length === 0) throw new Error("الحاوية مفيهاش أصناف");

  const po = await purchaseRepo.getPurchase(container.purchase_order_id);
  if (!po) throw new Error("أمر التوريد غير موجود");
  if (!po.supplier_id) throw new Error("أمر التوريد محتاج مورد");

  await assertPeriodOpen(container.store_id);

  const currency = (po.currency ?? "EGP").toUpperCase();
  const fxRate = Number(po.fx_rate ?? 1);
  if (currency !== "EGP" && !(fxRate > 0)) {
    throw new Error("سعر التحويل مطلوب على أمر التوريد");
  }

  const poLines = await purchaseRepo.getPurchaseLines(po.id);
  const poLineMap = new Map(poLines.map((line) => [line.id, line]));

  const invoice = await createDraftPurchase({
    storeId: container.store_id,
    warehouseId: container.warehouse_id,
    supplierId: po.supplier_id,
    createdBy: input.userId,
    documentKind: "purchase_invoice",
    sourceDocumentId: po.id,
    documentNotes: `حاوية ${container.container_number}`,
    currency,
    fxRate,
    containerId: container.id,
  });

  for (const line of lines) {
    const poLine = poLineMap.get(line.source_line_id);
    if (!poLine) throw new Error("سطر أمر التوريد ناقص");
    const foreignUnit =
      poLine.foreign_unit_cost != null && poLine.foreign_unit_cost > 0
        ? poLine.foreign_unit_cost
        : currency === "EGP"
          ? poLine.unit_cost
          : poLine.unit_cost / Math.max(fxRate, 1e-9);
    const converted = foreignLineToBase(foreignUnit, line.quantity, currency === "EGP" ? 1 : fxRate);
    await addPurchaseLine({
      invoiceId: invoice.id,
      productId: line.product_id,
      variantId: line.variant_id,
      quantity: line.quantity,
      unitCost: converted.unitCost,
      foreignUnitCost: currency === "EGP" ? null : foreignUnit,
      sourceLineId: line.source_line_id,
    });
  }

  const received = await receivePurchase(invoice.id, input.userId, {
    amountPaid: input.amountPaid,
    paymentMethod: input.paymentMethod,
  });

  await importRepo.updateContainer(container.id, {
    status: "received",
    received_at: new Date().toISOString(),
  });

  if (container.customs_certificate_id) {
    await syncCertificateLandedCosts({
      certificateId: container.customs_certificate_id,
      userId: input.userId,
    });
  }

  // Mark PO partial/invoiced based on remaining container allocation vs PO qty
  const allocated = await importRepo.sumContainerQtyBySourceLine(po.id);
  let allCovered = true;
  for (const poLine of poLines) {
    const used = allocated.get(poLine.id) ?? 0;
    if (used + 1e-9 < poLine.quantity) {
      allCovered = false;
      break;
    }
  }
  if (po.status === "sent" || po.status === "partial_invoiced" || po.status === "draft") {
    await purchaseRepo.updatePurchase(po.id, {
      status: allCovered ? "invoiced" : "partial_invoiced",
    });
  }

  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: container.store_id,
    userId: input.userId,
    action: "purchase_container.received",
    entityType: "purchase_container",
    entityId: container.id,
    metadata: { purchaseId: received.id },
  });

  const full = await getContainerWithLines(container.id);
  if (!full) throw new Error("الحاوية غير موجودة");
  const purchase = await getPurchase(received.id);
  if (!purchase) throw new Error("فاتورة الاستلام غير موجودة");
  return { container: full, purchase };
}

export async function listProductsForContainerLines(
  productIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const id of [...new Set(productIds)]) {
    const product = await catalogRepo.getProduct(id);
    if (product) names.set(id, product.name);
  }
  return names;
}
