import { describe, expect, it } from "vitest";
import {
  glSaleDiscount,
  lineTotalAfterDiscount,
  sumLineDiscounts,
} from "@/lib/line-discount";

describe("lineTotalAfterDiscount", () => {
  it("subtracts discount from qty × unit", () => {
    expect(lineTotalAfterDiscount(2, 50, 10)).toBe(90);
  });

  it("caps discount at gross line total", () => {
    expect(lineTotalAfterDiscount(1, 20, 50)).toBe(0);
  });

  it("treats negative inputs as zero contribution", () => {
    expect(lineTotalAfterDiscount(-1, 10, 0)).toBe(0);
    expect(lineTotalAfterDiscount(1, -10, 0)).toBe(0);
  });
});

describe("glSaleDiscount", () => {
  it("adds header discount to line discounts", () => {
    expect(
      glSaleDiscount(15, [{ discount_amount: 10 }, { discount_amount: 5 }])
    ).toBe(30);
  });

  it("treats missing line discounts as zero", () => {
    expect(sumLineDiscounts([{}, { discount_amount: null }])).toBe(0);
    expect(glSaleDiscount(8, [])).toBe(8);
  });
});

describe("lineTotalAfterDiscount", () => {
  it("subtracts discount from qty × unit", () => {
    expect(lineTotalAfterDiscount(2, 50, 10)).toBe(90);
  });

  it("caps discount at gross line total", () => {
    expect(lineTotalAfterDiscount(1, 20, 50)).toBe(0);
  });

  it("treats negative inputs as zero contribution", () => {
    expect(lineTotalAfterDiscount(-1, 10, 0)).toBe(0);
    expect(lineTotalAfterDiscount(1, -10, 0)).toBe(0);
  });
});
