import { describe, expect, it } from "vitest";
import {
  allocateCertificateCosts,
  foreignLineToBase,
  foreignUnitToBase,
} from "@/modules/purchases/lib/import-fx";

describe("import FX helpers", () => {
  it("converts foreign unit cost by fx rate", () => {
    expect(foreignUnitToBase(10, 50)).toBe(500);
    expect(foreignLineToBase(10, 3, 50)).toEqual({
      unitCost: 500,
      lineTotal: 1500,
      foreignLineTotal: 30,
    });
  });

  it("rejects non-positive fx rate", () => {
    expect(() => foreignUnitToBase(10, 0)).toThrow();
  });
});

describe("allocateCertificateCosts", () => {
  it("allocates by merchandise line total", () => {
    const shares = allocateCertificateCosts(
      [
        { id: "a", lineTotal: 100 },
        { id: "b", lineTotal: 300 },
      ],
      40
    );
    expect(shares.get("a")).toBe(10);
    expect(shares.get("b")).toBe(30);
  });
});
