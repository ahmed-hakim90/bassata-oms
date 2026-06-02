import { describe, expect, it } from "vitest";
import {
  computeLineCost,
  computeRecipeTotalCost,
} from "@/lib/repositories/recipe.repository";

describe("recipe costing", () => {
  it("computes line cost with unit conversion", () => {
    const cost = computeLineCost(0.08, "kg", 12, "kg");
    expect(cost).toBeCloseTo(0.96, 2);
  });

  it("sums recipe total cost", () => {
    const total = computeRecipeTotalCost([
      {
        quantity: 1,
        unit: "cup",
        ingredient_last_unit_cost: 0.15,
        ingredient_cost_unit: "cup",
      },
      {
        quantity: 0.08,
        unit: "kg",
        ingredient_last_unit_cost: 12,
        ingredient_cost_unit: "kg",
      },
    ]);
    expect(total).toBeCloseTo(1.11, 2);
  });
});
