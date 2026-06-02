import { describe, expect, it } from "vitest";
import { calculateExpiryDate } from "@/lib/inventory/expiry";

describe("calculateExpiryDate", () => {
  it("adds days correctly", () => {
    expect(calculateExpiryDate("2026-01-01", 90, "days")).toBe("2026-04-01");
  });

  it("adds months correctly", () => {
    expect(calculateExpiryDate("2026-01-15", 12, "months")).toBe("2027-01-15");
  });

  it("adds years correctly", () => {
    expect(calculateExpiryDate("2026-03-10", 2, "years")).toBe("2028-03-10");
  });

  it("returns production date when shelf life is zero", () => {
    expect(calculateExpiryDate("2026-06-02", 0, "days")).toBe("2026-06-02");
  });

  it("returns null when production date is missing", () => {
    expect(calculateExpiryDate(null, 30, "days")).toBeNull();
  });
});
