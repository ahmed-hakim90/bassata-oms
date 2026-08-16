import type { CommercialDocumentData } from "@/modules/print-engine/lib/commercial-document-types";
import type { CommercialDocumentKind } from "@/modules/print-engine/lib/print-engine-settings";

export function sampleCommercialDocument(kind: CommercialDocumentKind): CommercialDocumentData {
  const isPurchase = kind.startsWith("purchase");
  return {
    kind,
    number: "DEMO-0001",
    dateLabel: "16 أغسطس 2026",
    validUntil: kind === "quotation" ? "30 أغسطس 2026" : null,
    notes: "هذه معاينة للقالب — ليست مستندًا حقيقيًا.",
    watermark: kind === "quotation" || kind.endsWith("request") ? "مسودة" : null,
    partyLabel: isPurchase ? "المورد" : "العميل",
    party: {
      name: isPurchase ? "شركة التوريد النموذجية" : "عميل تجريبي",
      phone: "01000000000",
      address: "القاهرة",
      taxId: "123-456-789",
    },
    meta: [
      { label: "المخزن", value: "المخزن الرئيسي" },
      { label: "المرجع", value: "معاينة" },
    ],
    lines: [
      {
        id: "1",
        name: "صنف أول",
        sku: "SKU-100",
        unit: "قطعة",
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        lineTotal: 100,
      },
      {
        id: "2",
        name: "صنف ثاني",
        sku: "SKU-200",
        unit: "قطعة",
        quantity: 1,
        unitPrice: 75,
        discount: 5,
        lineTotal: 70,
      },
    ],
    subtotal: 170,
    discount: 0,
    tax: 23.8,
    total: 193.8,
  };
}
