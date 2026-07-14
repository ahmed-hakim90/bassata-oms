import { describe, expect, it } from "vitest";
import {
  documentDateToOccurredAt,
  isValidDocumentDate,
  normalizeDocumentDate,
  orderBusinessAt,
  purchaseBusinessAt,
  todayDocumentDate,
} from "@/lib/document-date";

describe("document-date helpers", () => {
  it("accepts valid calendar dates and rejects invalid / future", () => {
    expect(isValidDocumentDate("2026-01-15")).toBe(true);
    expect(isValidDocumentDate("2026-13-01")).toBe(false);
    expect(isValidDocumentDate("not-a-date")).toBe(false);
    expect(normalizeDocumentDate("2024-06-01")).toBe("2024-06-01");
    expect(() => normalizeDocumentDate("2099-01-01")).toThrow(/المستقبل/);
  });

  it("stamps midday UTC for stable day bucketing", () => {
    expect(documentDateToOccurredAt("2026-07-01")).toBe("2026-07-01T12:00:00.000Z");
  });

  it("prefers document_date for order / purchase business time", () => {
    expect(
      orderBusinessAt({
        document_date: "2026-03-10",
        created_at: "2026-07-15T10:00:00.000Z",
      })
    ).toBe("2026-03-10T12:00:00.000Z");

    expect(
      purchaseBusinessAt({
        document_date: "2026-02-01",
        received_at: "2026-02-01T12:00:00.000Z",
        created_at: "2026-07-15T10:00:00.000Z",
      })
    ).toBe("2026-02-01T12:00:00.000Z");

    expect(
      purchaseBusinessAt({
        document_date: "2026-02-01",
        received_at: null,
        created_at: "2026-07-15T10:00:00.000Z",
      })
    ).toBe("2026-02-01T12:00:00.000Z");
  });

  it("defaults empty document date to today", () => {
    expect(normalizeDocumentDate("")).toBe(todayDocumentDate());
    expect(normalizeDocumentDate(undefined)).toBe(todayDocumentDate());
  });
});
