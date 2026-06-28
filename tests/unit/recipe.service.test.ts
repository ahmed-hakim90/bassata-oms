import { describe, expect, it } from "vitest";
import {
  canProductBeRecipeIngredient,
  canProductHaveRecipe,
} from "@/modules/products/services/recipe.service";

describe("recipe product compatibility", () => {
  it("allows both current and legacy menu product types to have recipes", () => {
    expect(canProductHaveRecipe({ product_type: "finished_product" })).toBe(true);
    expect(canProductHaveRecipe({ product_type: "finished" })).toBe(true);
    expect(canProductHaveRecipe({ product_type: "service" })).toBe(false);
  });

  it("allows raw material inventory products as recipe ingredients", () => {
    expect(
      canProductBeRecipeIngredient({
        product_type: "raw_material",
        inventory_product_type: "raw_material",
      })
    ).toBe(true);
    expect(
      canProductBeRecipeIngredient({
        product_type: "ingredient",
        inventory_product_type: "raw_material",
      })
    ).toBe(true);
    expect(
      canProductBeRecipeIngredient({
        product_type: "packaging_material",
        inventory_product_type: "raw_material",
      })
    ).toBe(true);
    expect(
      canProductBeRecipeIngredient({
        product_type: "finished_product",
        inventory_product_type: "finished_product",
      })
    ).toBe(false);
  });
});
