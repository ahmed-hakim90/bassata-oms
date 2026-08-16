import { formatDateTime } from "@/lib/format";
import type { MeasurementUnit } from "@/lib/types";
import { formatUnit } from "@/lib/units";
import type { CommercialDocumentData } from "@/modules/print-engine/lib/commercial-document-types";
import type { CommercialDocumentKind } from "@/modules/print-engine/lib/print-engine-settings";

const SALES_KINDS = new Set<CommercialDocumentKind>([
  "quotation",
  "sales_order",
  "sales_invoice",
  "credit_note",
]);

const PURCHASE_KINDS = new Set<CommercialDocumentKind>([
  "purchase_request",
  "purchase_order",
  "purchase_invoice",
  "purchase_return",
]);

function watermarkForStatus(status?: string | null): string | null {
  if (status === "draft") return "مسودة";
  if (status === "cancelled" || status === "rejected") return "ملغي";
  return null;
}

export function salesKindFromOrder(
  documentKind?: string | null
): CommercialDocumentKind {
  if (documentKind && SALES_KINDS.has(documentKind as CommercialDocumentKind)) {
    return documentKind as CommercialDocumentKind;
  }
  return "pos_a4";
}

export function purchaseKindFromDocument(
  documentKind?: string | null
): CommercialDocumentKind {
  if (documentKind && PURCHASE_KINDS.has(documentKind as CommercialDocumentKind)) {
    return documentKind as CommercialDocumentKind;
  }
  return "purchase_invoice";
}

export function canPrintAsDeliveryNote(documentKind?: string | null): boolean {
  const kind = salesKindFromOrder(documentKind);
  return kind === "sales_invoice" || kind === "pos_a4";
}

function unitLabel(unit?: string | null): string | null {
  if (!unit) return null;
  const formatted = formatUnit(unit as MeasurementUnit);
  return formatted || unit;
}

export function mapOrderToCommercialDocument(
  order: {
    document_kind?: string | null;
    document_status?: string | null;
    order_number: string;
    created_at: string;
    document_date?: string;
    valid_until?: string | null;
    document_notes?: string;
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    customerTaxId?: string | null;
    items: Array<{
      id: string;
      productName: string;
      sku?: string | null;
      quantity: number;
      unit_price: number;
      discount_amount?: number;
      line_total: number;
      sale_unit?: string | null;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  },
  options?: { kind?: CommercialDocumentKind }
): CommercialDocumentData {
  const base = salesKindFromOrder(order.document_kind);
  const kind =
    options?.kind === "delivery_note" && canPrintAsDeliveryNote(order.document_kind)
      ? "delivery_note"
      : base;
  return {
    kind,
    number: order.order_number,
    dateLabel: formatDateTime(
      order.document_date ? `${order.document_date}T12:00:00.000Z` : order.created_at
    ),
    validUntil: order.valid_until ?? null,
    notes: order.document_notes ?? null,
    watermark: watermarkForStatus(order.document_status),
    partyLabel: "العميل",
    party: order.customerName
      ? {
          name: order.customerName,
          phone: order.customerPhone,
          email: order.customerEmail,
          address: order.customerAddress,
          taxId: order.customerTaxId,
        }
      : null,
    lines: order.items.map((item) => ({
      id: item.id,
      name: item.productName,
      sku: item.sku ?? null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount_amount,
      lineTotal: item.line_total,
      unit: unitLabel(item.sale_unit),
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax,
    total: order.total,
  };
}

export function mapPurchaseToCommercialDocument(input: {
  purchase: {
    document_kind?: string | null;
    status: string;
    invoice_number: string;
    created_at: string;
    document_date?: string;
    document_notes?: string;
    supplierName: string;
    warehouseName: string;
    supplierAddress?: string | null;
    supplierTaxId?: string | null;
    supplierContact?: string | null;
    lines: Array<{
      id: string;
      product_id: string;
      quantity: number;
      unit_cost: number;
      line_total: number;
    }>;
    subtotal: number;
    extra_cost?: number;
    tax: number;
    total: number;
  };
  productMap: Map<string, { name: string; sku?: string | null; unit?: string | null }>;
}): CommercialDocumentData {
  const { purchase, productMap } = input;
  const kind = purchaseKindFromDocument(purchase.document_kind);
  return {
    kind,
    number: purchase.invoice_number,
    dateLabel: formatDateTime(
      purchase.document_date
        ? `${purchase.document_date}T12:00:00.000Z`
        : purchase.created_at
    ),
    notes: purchase.document_notes ?? null,
    watermark: watermarkForStatus(purchase.status),
    partyLabel: "المورد",
    party: purchase.supplierName
      ? {
          name: purchase.supplierName,
          phone: purchase.supplierContact,
          address: purchase.supplierAddress,
          taxId: purchase.supplierTaxId,
        }
      : null,
    meta: [{ label: "المخزن", value: purchase.warehouseName }],
    lines: purchase.lines.map((line) => {
      const product = productMap.get(line.product_id);
      return {
        id: line.id,
        name: product?.name ?? "صنف غير معروف",
        sku: product?.sku ?? null,
        unit: unitLabel(product?.unit),
        quantity: line.quantity,
        unitPrice: line.unit_cost,
        lineTotal: line.line_total,
      };
    }),
    subtotal: purchase.subtotal,
    discount: 0,
    tax: purchase.tax,
    extraCost: purchase.extra_cost,
    total: purchase.total,
  };
}
