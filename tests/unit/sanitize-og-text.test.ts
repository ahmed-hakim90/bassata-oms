import { describe, expect, it } from "vitest";
import { compactArabicOgSpaces } from "@/lib/og/compact-arabic-og-spaces";
import {
  orderOgTextForSatori,
  sanitizeOgText,
} from "@/lib/og/sanitize-og-text";

describe("sanitizeOgText", () => {
  it("returns fallback for empty values", () => {
    expect(sanitizeOgText("")).toBe("منيو أونلاين");
    expect(sanitizeOgText("   ")).toBe("منيو أونلاين");
    expect(sanitizeOgText(null)).toBe("منيو أونلاين");
  });

  it("keeps pure Arabic and Latin names", () => {
    expect(sanitizeOgText("نوتيلا و موتزريلا")).toBe("نوتيلا و موتزريلا");
    expect(sanitizeOgText("Bassata")).toBe("Bassata");
  });

  it("replaces unicode dashes that break Satori Arabic shaping", () => {
    expect(sanitizeOgText("كافيه النور — فرع المعادي")).toBe(
      "كافيه النور - فرع المعادي"
    );
  });

  it("prefers Arabic when mixed LTR/RTL brand names exist", () => {
    expect(sanitizeOgText("Cafe النور")).toBe("النور");
    expect(sanitizeOgText("بساطه - Bassata")).toBe("بساطه");
  });
});

describe("orderOgTextForSatori", () => {
  it("reverses Arabic word order for Satori LTR layout", () => {
    expect(orderOgTextForSatori("منيو أونلاين")).toBe("أونلاين منيو");
    expect(orderOgTextForSatori("نوتيلا و موتزريلا")).toBe("موتزريلا و نوتيلا");
  });

  it("leaves Latin text unchanged", () => {
    expect(orderOgTextForSatori("Bassata")).toBe("Bassata");
  });
});

describe("compactArabicOgSpaces", () => {
  it("keeps و attached to the following word", () => {
    expect(compactArabicOgSpaces("نوتيلا و موتزريلا")).toBe("نوتيلا وموتزريلا");
  });
});
