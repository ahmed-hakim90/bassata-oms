import { describe, expect, it } from "vitest";
import {
  classifyStockCardMovement,
} from "@/modules/reports/lib/product-stock-buckets";

describe("classifyStockCardMovement", () => {
  it("maps purchases and transfer_in to in", () => {
    expect(classifyStockCardMovement("purchase", 10)).toBe("in");
    expect(classifyStockCardMovement("transfer_in", 5)).toBe("in");
    expect(classifyStockCardMovement("reservation_release", 2)).toBe("in");
  });

  it("maps sales and waste to out", () => {
    expect(classifyStockCardMovement("sale", -3)).toBe("out");
    expect(classifyStockCardMovement("waste", -1)).toBe("out");
    expect(classifyStockCardMovement("reservation", -4)).toBe("out");
  });

  it("maps adjustment and stock_count to equalize", () => {
    expect(classifyStockCardMovement("adjustment", 2)).toBe("equalize");
    expect(classifyStockCardMovement("stock_count", -1)).toBe("equalize");
  });
});
