import { describe, expect, it } from "vitest";
import {
  buildEscPosReceiptBytes,
  buildWhatsAppReceiptUrl,
  formatReceiptForEscPos,
  formatReceiptForWhatsApp,
  normalizeWhatsAppPhone,
  type ReceiptPayload,
} from "@/modules/pos/services/receipt-format.service";

const receipt: ReceiptPayload = {
  orderNumber: "ORD-1001",
  createdAt: "2026-06-18T20:00:00.000Z",
  paymentMethod: "cash",
  payments: [{ method: "cash", amount: 18 }],
  discount: 2,
  total: 18,
  customer: { name: "Mona", phone: "+201001112222" },
  branding: {
    orgName: "Bassata Cafe",
    orgLogoUrl: null,
    currency: "EGP",
    storeName: "Main Branch",
    storeAddress: "Cairo",
    storePhone: "+202000000",
    receiptHeader: "Fresh daily",
    receiptFooter: "See you soon",
  },
  lines: [
    {
      id: "line-1",
      productId: "product-1",
      variantId: null,
      name: "Latte",
      quantity: 2,
      unitPrice: 10,
      modifiers: [],
      lineTotal: 20,
      imageUrl: null,
    },
  ],
};

describe("receipt formatting", () => {
  it("formats a complete WhatsApp receipt message", () => {
    const message = formatReceiptForWhatsApp(receipt);

    expect(message).toContain("*Bassata Cafe*");
    expect(message).toContain("Main Branch");
    expect(message).toContain("Cairo");
    expect(message).toContain("Fresh daily");
    expect(message).toContain("Order #ORD-1001");
    expect(message).toContain("Latte");
    expect(message).toContain("Discount");
    expect(message).toContain("See you soon");
  });

  it("includes full branding on ESC/POS text", () => {
    const text = formatReceiptForEscPos(receipt);
    expect(text).toContain("Bassata Cafe");
    expect(text).toContain("Main Branch");
    expect(text).toContain("Cairo");
    expect(text).toContain("+202000000");
    expect(text).toContain("Fresh daily");
    expect(text).toContain("See you soon");
  });

  it("normalizes WhatsApp phone numbers for wa.me links", () => {
    expect(normalizeWhatsAppPhone("+20 100 111 2222")).toBe("201001112222");
    expect(normalizeWhatsAppPhone("01001112222")).toBe("201001112222");
    expect(normalizeWhatsAppPhone("0501234567")).toBe("966501234567");
    expect(normalizeWhatsAppPhone("00201001112222")).toBe("201001112222");
    expect(normalizeWhatsAppPhone("0000")).toBeNull();
    expect(normalizeWhatsAppPhone("")).toBeNull();
  });

  it("builds a WhatsApp URL when the customer phone is valid", () => {
    const url = buildWhatsAppReceiptUrl(receipt);

    expect(url).toMatch(/^https:\/\/wa\.me\/201001112222\?text=/);
    expect(decodeURIComponent(url ?? "")).toContain("Order #ORD-1001");
  });

  it("builds ESC/POS bytes with initialize and cut commands", () => {
    const bytes = buildEscPosReceiptBytes(receipt);

    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
    expect(new TextDecoder().decode(bytes)).toContain("Bassata Cafe");
  });
});
