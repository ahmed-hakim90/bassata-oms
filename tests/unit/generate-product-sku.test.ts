import { describe, expect, it } from "vitest";
import { nextSequentialProductSku } from "@/modules/products/lib/generate-product-sku";

describe("nextSequentialProductSku", () => {
  it("starts at PRD-0001 when no matching codes exist", () => {
    expect(nextSequentialProductSku([])).toBe("PRD-0001");
    expect(nextSequentialProductSku(["ICE-001", "LATTE-X7K2"])).toBe("PRD-0001");
  });

  it("increments from the highest PRD code", () => {
    expect(nextSequentialProductSku(["PRD-0001", "PRD-0042", "PRD-0009"])).toBe("PRD-0043");
  });

  it("ignores name-based or unrelated codes", () => {
    expect(nextSequentialProductSku(["PRD-0003", "COFFEE-LATTE"])).toBe("PRD-0004");
  });
});
