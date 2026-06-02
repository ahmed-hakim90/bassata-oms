import { describe, expect, it } from "vitest";
import { requiresManagerDiscountOverride } from "@/modules/pos/services/manager-override.service";

describe("requiresManagerDiscountOverride", () => {
  it("does not require override when no threshold is configured", () => {
    expect(requiresManagerDiscountOverride(100, null)).toBe(false);
  });

  it("requires override only when discount is above threshold", () => {
    expect(requiresManagerDiscountOverride(10, 10)).toBe(false);
    expect(requiresManagerDiscountOverride(10.01, 10)).toBe(true);
  });
});
