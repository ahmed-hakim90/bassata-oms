import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRINT_ENGINE_SETTINGS,
  normalizePrintBlocks,
  parsePrintEngineSettings,
  resolvePrintTemplate,
} from "@/modules/print-engine/lib/print-engine-settings";
import { amountInArabicWords } from "@/modules/print-engine/lib/amount-in-words-ar";
import { remainingPurchaseLineQty } from "@/modules/purchases/lib/remaining-qty";
import { formatCommercialDocumentForWhatsApp } from "@/modules/pos/services/receipt-format.service";
import {
  purchaseKindFromDocument,
  salesKindFromOrder,
  canPrintAsDeliveryNote,
  mapOrderToCommercialDocument,
} from "@/modules/print-engine/lib/map-commercial-document";

describe("print engine settings", () => {
  it("falls back to defaults for invalid payloads", () => {
    const parsed = parsePrintEngineSettings({ layout: "unknown", colors: "bad" });
    const template = resolvePrintTemplate(parsed);
    expect(template.layout).toBe("classic");
    expect(template.fields.showAmountInWords).toBe(true);
  });

  it("wraps a legacy single template and keeps overrides", () => {
    const parsed = parsePrintEngineSettings({
      layout: "modern",
      company: {
        legalName: "",
        taxId: "123",
        commercialRegister: "",
        address: "",
        phone: "",
        email: "",
        bankDetails: "",
      },
      documents: { quotation: { title: "عرض أسعار", showWatermark: true } },
    });
    const template = resolvePrintTemplate(parsed);
    expect(parsed.templates).toHaveLength(1);
    expect(template.layout).toBe("modern");
    expect(template.company.taxId).toBe("123");
    expect(template.documents?.quotation?.title).toBe("عرض أسعار");
    expect(template.documents?.quotation?.showWatermark).toBe(true);
  });

  it("keeps named templates and per-kind assignment", () => {
    const parsed = parsePrintEngineSettings({
      ...DEFAULT_PRINT_ENGINE_SETTINGS,
      defaultTemplateId: "classic",
      assignments: { quotation: "modern" },
    });
    expect(resolvePrintTemplate(parsed, "sales_invoice").id).toBe("classic");
    expect(resolvePrintTemplate(parsed, "quotation").id).toBe("modern");
    expect(resolvePrintTemplate(parsed, "quotation").layout).toBe("modern");
  });

  it("normalizes missing print blocks to a full ordered list", () => {
    const blocks = normalizePrintBlocks([{ id: "lines", enabled: true }]);
    expect(blocks[0]?.id).toBe("lines");
    expect(blocks.map((block) => block.id)).toEqual([
      "lines",
      "header",
      "party",
      "totals",
      "notes",
      "signature",
      "qr",
      "footer",
    ]);
  });
});

describe("amount in arabic words", () => {
  it("formats pounds and piastres", () => {
    expect(amountInArabicWords(1)).toContain("جنيه");
    expect(amountInArabicWords(0)).toContain("صفر");
    expect(amountInArabicWords(12.5)).toContain("قرش");
  });
});

describe("purchase remaining qty", () => {
  it("never goes below zero", () => {
    expect(remainingPurchaseLineQty(10, 4)).toBe(6);
    expect(remainingPurchaseLineQty(10, 12)).toBe(0);
  });
});

describe("commercial document mapping", () => {
  it("maps POS orders without kind to pos_a4", () => {
    expect(salesKindFromOrder(null)).toBe("pos_a4");
    expect(salesKindFromOrder("quotation")).toBe("quotation");
  });

  it("maps unknown purchase kinds to purchase_invoice", () => {
    expect(purchaseKindFromDocument(undefined)).toBe("purchase_invoice");
    expect(purchaseKindFromDocument("purchase_order")).toBe("purchase_order");
  });

  it("prints sales invoices as delivery notes when requested", () => {
    expect(canPrintAsDeliveryNote("sales_invoice")).toBe(true);
    expect(canPrintAsDeliveryNote(null)).toBe(true);
    expect(canPrintAsDeliveryNote("quotation")).toBe(false);

    const delivery = mapOrderToCommercialDocument(
      {
        document_kind: "sales_invoice",
        order_number: "SI-20260816-0001",
        created_at: "2026-08-16T12:00:00.000Z",
        items: [
          {
            id: "1",
            productName: "قهوة",
            sku: "SKU-100",
            quantity: 2,
            unit_price: 25,
            line_total: 50,
            sale_unit: "piece",
          },
        ],
        subtotal: 50,
        discount: 0,
        tax: 0,
        total: 50,
      },
      { kind: "delivery_note" }
    );
    expect(delivery.kind).toBe("delivery_note");
    expect(delivery.lines[0]?.sku).toBe("SKU-100");
    expect(delivery.lines[0]?.unit).toBe("قطعة");
  });

  it("ignores delivery override on quotations", () => {
    const quotation = mapOrderToCommercialDocument(
      {
        document_kind: "quotation",
        order_number: "QT-1",
        created_at: "2026-08-16T12:00:00.000Z",
        items: [
          {
            id: "1",
            productName: "قهوة",
            quantity: 1,
            unit_price: 10,
            line_total: 10,
          },
        ],
        subtotal: 10,
        discount: 0,
        tax: 0,
        total: 10,
      },
      { kind: "delivery_note" }
    );
    expect(quotation.kind).toBe("quotation");
  });
});

describe("commercial whatsapp text", () => {
  it("includes title, number, and total", () => {
    const text = formatCommercialDocumentForWhatsApp({
      title: "عرض سعر",
      number: "QT-20260816-0001",
      partyName: "عميل",
      total: 50,
      currency: "EGP",
      lines: [{ name: "قهوة", quantity: 2, lineTotal: 50 }],
    });
    expect(text).toContain("عرض سعر");
    expect(text).toContain("QT-20260816-0001");
    expect(text).toContain("قهوة");
  });
});
