import { roundMoney } from "@/lib/money";

/**
 * Invoice `extra_cost` is the supplier add-on on the commercial invoice
 * (freight printed on the invoice). Certificate costs are customs/port/agent
 * fees. Both capitalize to inventory; entering the same economic amount on
 * both double-counts landed cost. Legitimate split: freight on invoice +
 * customs on the certificate.
 */
export const EXTRA_COST_INVOICE_HINT =
  "التكلفة الإضافية من المورد على الفاتورة التجارية (شحن ظاهر على الفاتورة). الجمارك والمينا والمخلص على الشهادة الجمركية — متسجلش نفس المصروف مرتين.";

export const CERTIFICATE_COST_HINT =
  "المصروف هنا بيترسمل على المخزون فوق تكلفة الفاتورة. لو الشحن مكتوب على فاتورة المورد، سيبه في «تكلفة إضافية» هناك ومتكررهوش هنا.";

export function sumLinkedInvoiceExtraCost(
  invoices: { extra_cost: number }[]
): number {
  return roundMoney(
    invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.extra_cost), 0)
  );
}
