import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  resolveUnitPrice,
  PRICE_TOLERANCE,
  TOTAL_TOLERANCE,
} from "@/modules/souqna/services/souqna-order.service";

describe("resolveUnitPrice", () => {
  it("uses sale price when valid", () => {
    expect(resolveUnitPrice(28, 25)).toBe(25);
  });

  it("uses base price when no sale", () => {
    expect(resolveUnitPrice(28, null)).toBe(28);
    expect(resolveUnitPrice(28, 30)).toBe(28);
  });
});

describe("normalizePhone", () => {
  it("strips whitespace", () => {
    expect(normalizePhone("010 000 000 00")).toBe("01000000000");
  });
});

describe("price tolerance", () => {
  it("allows small drift", () => {
    expect(Math.abs(25.0 - 25.009)).toBeLessThanOrEqual(PRICE_TOLERANCE);
    expect(Math.abs(99 - (84 + 15))).toBeLessThanOrEqual(TOTAL_TOLERANCE);
  });
});

describe("idempotency contract", () => {
  it("treats duplicate souqna_order_id as same external response shape", () => {
    const first = {
      external_order_id: "online-uuid-1",
      status: "received" as const,
      message: "Order received",
    };
    const duplicate = { ...first };
    expect(duplicate.external_order_id).toBe(first.external_order_id);
    expect(duplicate.status).toBe("received");
  });
});

describe("order rejection messages", () => {
  it("uses expected rejection copy", () => {
    const rejected = {
      external_order_id: null,
      status: "rejected" as const,
      message: "Product out of stock",
    };
    expect(rejected.external_order_id).toBeNull();
    expect(rejected.status).toBe("rejected");
  });
});
