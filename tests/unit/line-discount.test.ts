import { describe, expect, it } from "vitest";
import { lineTotalAfterDiscount } from "@/lib/line-discount";

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
