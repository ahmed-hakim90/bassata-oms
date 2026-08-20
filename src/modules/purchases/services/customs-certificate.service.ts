import * as importRepo from "@/lib/repositories/purchase-import.repository";
import * as purchaseRepo from "@/lib/repositories/purchase.repository";
import { getDb, throwDbError } from "@/lib/repositories/client";
import { getOrgId } from "@/lib/repositories/organization.repository";
import { writeAuditLog } from "@/lib/services/audit.service";
import { todayDocumentDate } from "@/lib/document-date";
import { roundMoney } from "@/lib/money";
import { isFeatureEnabled } from "@/modules/system/services/settings.service";
import {
  allocateCertificateCosts,
} from "@/modules/purchases/lib/import-fx";
import { sumLinkedInvoiceExtraCost } from "@/modules/purchases/lib/landed-cost-split";
import {
  type CustomsCertificateCostType,
  CUSTOMS_CERTIFICATE_COST_TYPES,
} from "@/modules/purchases/lib/import-constants";
import { allocateLandedCosts } from "@/modules/purchases/services/purchase.service";
import {
  safePostCustomsCertificateJournal,
} from "@/modules/accounting/services/gl-posting.service";
import { after } from "next/server";

export type CertificateWithDetails = importRepo.CustomsCertificateRow & {
  costs: importRepo.CustomsCertificateCostRow[];
  containers: importRepo.PurchaseContainerRow[];
  costsTotal: number;
  /** Supplier add-on already on linked commercial invoices (not cancelled). */
  linkedInvoiceExtraCost: number;
};

async function assertImportsEnabled(): Promise<void> {
  if (!(await isFeatureEnabled("purchase_imports"))) {
    throw new Error("استيراد الحاويات مش مفعّل — فعّله من إعدادات النظام");
  }
}

export async function listCertificatesWithDetails(options?: {
  storeId?: string;
}): Promise<CertificateWithDetails[]> {
  await assertImportsEnabled();
  const certificates = await importRepo.listCertificates(options);
  const costs = await importRepo.listCertificateCosts(certificates.map((c) => c.id));
  const costsByCert = new Map<string, importRepo.CustomsCertificateCostRow[]>();
  for (const cost of costs) {
    const list = costsByCert.get(cost.certificate_id) ?? [];
    list.push(cost);
    costsByCert.set(cost.certificate_id, list);
  }
  const containers = await importRepo.listContainers({
    storeId: options?.storeId,
  });
  const containersByCert = new Map<string, importRepo.PurchaseContainerRow[]>();
  for (const container of containers) {
    if (!container.customs_certificate_id) continue;
    const list = containersByCert.get(container.customs_certificate_id) ?? [];
    list.push(container);
    containersByCert.set(container.customs_certificate_id, list);
  }
  const extraRows = await importRepo.listOpenInvoiceExtraCostsForContainers(
    containers.filter((c) => c.customs_certificate_id).map((c) => c.id)
  );
  const extraByContainer = new Map<string, { extra_cost: number }[]>();
  for (const row of extraRows) {
    const list = extraByContainer.get(row.container_id) ?? [];
    list.push(row);
    extraByContainer.set(row.container_id, list);
  }
  return certificates.map((cert) => {
    const certCosts = costsByCert.get(cert.id) ?? [];
    const certContainers = containersByCert.get(cert.id) ?? [];
    const linkedInvoices = certContainers.flatMap(
      (container) => extraByContainer.get(container.id) ?? []
    );
    return {
      ...cert,
      costs: certCosts,
      containers: certContainers,
      costsTotal: roundMoney(certCosts.reduce((sum, c) => sum + c.amount, 0)),
      linkedInvoiceExtraCost: sumLinkedInvoiceExtraCost(linkedInvoices),
    };
  });
}

export async function getCertificateWithDetails(
  certificateId: string
): Promise<CertificateWithDetails | null> {
  await assertImportsEnabled();
  const cert = await importRepo.getCertificate(certificateId);
  if (!cert) return null;
  const list = await listCertificatesWithDetails({ storeId: cert.store_id });
  return list.find((c) => c.id === certificateId) ?? null;
}

export async function createCertificate(input: {
  storeId: string;
  certificateNumber: string;
  certificateDate?: string;
  notes?: string;
  createdBy: string;
}): Promise<CertificateWithDetails> {
  await assertImportsEnabled();
  const number = input.certificateNumber.trim();
  if (!number) throw new Error("رقم الشهادة الجمركية مطلوب");
  const cert = await importRepo.insertCertificate({
    store_id: input.storeId,
    certificate_number: number,
    status: "open",
    certificate_date: input.certificateDate ?? todayDocumentDate(),
    notes: (input.notes ?? "").trim().slice(0, 500),
    created_by: input.createdBy,
  });
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: input.storeId,
    userId: input.createdBy,
    action: "customs_certificate.created",
    entityType: "customs_certificate",
    entityId: cert.id,
  });
  const full = await getCertificateWithDetails(cert.id);
  if (!full) throw new Error("فشل إنشاء الشهادة");
  return full;
}

export async function closeCertificate(input: {
  certificateId: string;
  userId: string;
}): Promise<CertificateWithDetails> {
  await assertImportsEnabled();
  const cert = await importRepo.getCertificate(input.certificateId);
  if (!cert) throw new Error("الشهادة غير موجودة");
  if (cert.status === "closed") throw new Error("الشهادة مقفولة");
  const containers = await importRepo.listContainers({
    certificateId: cert.id,
  });
  const openContainers = containers.filter(
    (c) => c.status !== "received" && c.status !== "cancelled"
  );
  if (openContainers.length > 0) {
    throw new Error("اقفل الشهادة بعد استلام كل الحاويات");
  }
  await importRepo.updateCertificate(cert.id, {
    status: "closed",
    closed_at: new Date().toISOString(),
  });
  const orgId = await getOrgId();
  await writeAuditLog({
    orgId,
    storeId: cert.store_id,
    userId: input.userId,
    action: "customs_certificate.closed",
    entityType: "customs_certificate",
    entityId: cert.id,
  });
  const full = await getCertificateWithDetails(cert.id);
  if (!full) throw new Error("الشهادة غير موجودة");
  return full;
}

export async function addCertificateCost(input: {
  certificateId: string;
  costType: CustomsCertificateCostType;
  amount: number;
  payeeSupplierId?: string | null;
  paymentMethod?: "cash" | "card" | "wallet" | "other" | null;
  notes?: string;
  createdBy: string;
}): Promise<CertificateWithDetails> {
  await assertImportsEnabled();
  const cert = await importRepo.getCertificate(input.certificateId);
  if (!cert) throw new Error("الشهادة غير موجودة");
  if (cert.status === "closed") throw new Error("الشهادة مقفولة");
  if (!(CUSTOMS_CERTIFICATE_COST_TYPES as readonly string[]).includes(input.costType)) {
    throw new Error("نوع المصروف غير صحيح");
  }
  const amount = roundMoney(Math.max(0, input.amount));
  if (!(amount > 0)) throw new Error("مبلغ المصروف لازم يكون أكبر من صفر");

  await importRepo.insertCertificateCost({
    certificate_id: cert.id,
    cost_type: input.costType,
    amount,
    payee_supplier_id: input.payeeSupplierId ?? null,
    payment_method: input.paymentMethod ?? null,
    notes: (input.notes ?? "").trim().slice(0, 500),
    created_by: input.createdBy,
  });

  await syncCertificateLandedCosts({
    certificateId: cert.id,
    userId: input.createdBy,
  });

  const full = await getCertificateWithDetails(cert.id);
  if (!full) throw new Error("الشهادة غير موجودة");
  return full;
}

export async function removeCertificateCost(input: {
  costId: string;
  userId: string;
}): Promise<CertificateWithDetails> {
  await assertImportsEnabled();
  const certificates = await importRepo.listCertificates();
  const allCosts = await importRepo.listCertificateCosts(certificates.map((c) => c.id));
  const cost = allCosts.find((c) => c.id === input.costId);
  if (!cost) throw new Error("المصروف غير موجود");
  const cert = await importRepo.getCertificate(cost.certificate_id);
  if (!cert) throw new Error("الشهادة غير موجودة");
  if (cert.status === "closed") throw new Error("الشهادة مقفولة");
  if (cost.posted_amount > 0) {
    throw new Error("المصروف مترحّل — مينفعش يتمسح بعد الترحيل");
  }
  await importRepo.deleteCertificateCost(cost.id);
  await syncCertificateLandedCosts({
    certificateId: cert.id,
    userId: input.userId,
  });
  const full = await getCertificateWithDetails(cert.id);
  if (!full) throw new Error("الشهادة غير موجودة");
  return full;
}

/**
 * Recompute landed costs on received container invoices for this certificate,
 * and post GL delta for newly capitalized costs.
 */
export async function syncCertificateLandedCosts(input: {
  certificateId: string;
  userId: string;
}): Promise<void> {
  const cert = await importRepo.getCertificate(input.certificateId);
  if (!cert) return;

  const containers = await importRepo.listContainers({ certificateId: cert.id });
  const receivedContainers = containers.filter((c) => c.status === "received");
  if (receivedContainers.length === 0) return;

  const invoices = await importRepo.listReceivedInvoicesForContainers(
    receivedContainers.map((c) => c.id)
  );
  if (invoices.length === 0) return;

  const costs = await importRepo.listCertificateCosts([cert.id]);
  const costsTotal = roundMoney(costs.reduce((sum, c) => sum + c.amount, 0));

  type LineRef = {
    id: string;
    invoiceId: string;
    productId: string;
    quantity: number;
    lineTotal: number;
    extraLanded: number;
  };
  const allLines: LineRef[] = [];

  for (const invoice of invoices) {
    const lines = await purchaseRepo.getPurchaseLines(invoice.id);
    const baseAlloc = allocateLandedCosts(lines, invoice.extra_cost);
    for (const line of lines) {
      const base = baseAlloc.get(line.id);
      const extraLanded = base
        ? roundMoney(base.landedLineTotal - line.line_total)
        : 0;
      allLines.push({
        id: line.id,
        invoiceId: invoice.id,
        productId: line.product_id,
        quantity: line.quantity,
        lineTotal: line.line_total,
        extraLanded,
      });
    }
  }

  const certShares = allocateCertificateCosts(
    allLines.map((l) => ({ id: l.id, lineTotal: l.lineTotal })),
    costsTotal
  );

  for (const line of allLines) {
    const certShare = certShares.get(line.id) ?? 0;
    const landedLineTotal = roundMoney(line.lineTotal + line.extraLanded + certShare);
    const landedUnitCost =
      line.quantity > 0
        ? Number((landedLineTotal / line.quantity).toFixed(4))
        : 0;
    await purchaseRepo.updatePurchaseLine(line.id, {
      landed_unit_cost: landedUnitCost,
      landed_line_total: landedLineTotal,
    });
    const db = await getDb();
    const { error } = await db
      .from("products")
      .update({ last_unit_cost: landedUnitCost } as never)
      .eq("id", line.productId);
    if (error) throwDbError(error, "syncCertificateLandedCosts.product");
  }

  // Post GL for unposted cost amounts (inventory Dr / AP or cash Cr)
  for (const cost of costs) {
    const delta = roundMoney(cost.amount - cost.posted_amount);
    if (delta <= 0) continue;
    after(() => {
      void safePostCustomsCertificateJournal({
        certificateId: cert.id,
        costId: cost.id,
        storeId: cert.store_id,
        amount: delta,
        paymentMethod: cost.payment_method ?? undefined,
        createdBy: input.userId,
        memo: `شهادة جمركية ${cert.certificate_number} — رسملة مصروف`,
      });
    });
    await importRepo.updateCertificateCost(cost.id, {
      posted_amount: cost.amount,
    });
  }
}
