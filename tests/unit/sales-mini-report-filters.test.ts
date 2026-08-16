import { describe, expect, it } from "vitest";
import { parseAgingSide } from "@/modules/reports/lib/aging-side";
import { reportFiltersSchema } from "@/modules/reports/core/report-filters.schema";

describe("sales mini-report filters", () => {
  it("accepts cashierId in report filters", () => {
    const parsed = reportFiltersSchema.parse({
      cashierId: "user-1",
      productId: "prod-1",
      days: "30",
    });
    expect(parsed.cashierId).toBe("user-1");
    expect(parsed.productId).toBe("prod-1");
    expect(parsed.days).toBe(30);
  });
});

describe("aging side helper", () => {
  it("parses side query", () => {
    expect(parseAgingSide("customers")).toBe("customers");
    expect(parseAgingSide("suppliers")).toBe("suppliers");
    expect(parseAgingSide(undefined)).toBe("all");
  });
});
