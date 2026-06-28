import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteProduct,
  deriveProductCapabilityFields,
} from "@/modules/products/services/product.service";
import * as catalogRepo from "@/lib/repositories/catalog.repository";
import * as recipeRepo from "@/lib/repositories/recipe.repository";

vi.mock("@/lib/repositories/catalog.repository");
vi.mock("@/lib/repositories/recipe.repository");
vi.mock("@/lib/repositories/store.repository");
vi.mock("@/lib/services/audit.service", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/lib/repositories/organization.repository", () => ({
  getOrgId: vi.fn(() => "org-1"),
}));

describe("deriveProductCapabilityFields", () => {
  it("marks weight and amount sale support for weight products with price input", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "finished_product",
        sales_unit_type: "weight",
        allow_price_input: true,
        inventory_tracking_mode: "batch_and_expiry",
        track_inventory: true,
      })
    ).toEqual({
      inventory_product_type: "finished_product",
      supports_weight_sale: true,
      supports_amount_sale: true,
    });
  });

  it("maps legacy ingredient type to raw material inventory product type", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "ingredient",
        sales_unit_type: "weight",
        allow_price_input: false,
        inventory_tracking_mode: "batch",
        track_inventory: true,
      })
    ).toEqual({
      inventory_product_type: "raw_material",
      supports_weight_sale: true,
      supports_amount_sale: false,
    });
  });

  it("maps legacy finished type to finished product inventory type", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "finished",
        sales_unit_type: "piece",
        allow_price_input: false,
        inventory_tracking_mode: "standard",
        track_inventory: true,
      })
    ).toEqual({
      inventory_product_type: "finished_product",
      supports_weight_sale: false,
      supports_amount_sale: false,
    });
  });

  it("preserves explicit inventory product type for legacy product rows", () => {
    expect(
      deriveProductCapabilityFields({
        product_type: "finished",
        inventory_product_type: "service",
        sales_unit_type: "piece",
        allow_price_input: false,
        inventory_tracking_mode: "none",
        track_inventory: false,
      })
    ).toEqual({
      inventory_product_type: "service",
      supports_weight_sale: false,
      supports_amount_sale: false,
    });
  });
});

describe("deleteProduct", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reports the products that use an ingredient before deleting it", async () => {
    vi.mocked(recipeRepo.listRecipeUsagesByIngredient).mockResolvedValue([
      { recipeId: "recipe-1", productId: "product-1", variantId: null },
      { recipeId: "recipe-2", productId: "product-2", variantId: "variant-1" },
    ]);
    vi.mocked(catalogRepo.listProducts).mockResolvedValue([
      {
        id: "product-1",
        org_id: "org-1",
        name: "Latte",
        sku: "LATTE",
        barcode: "",
        category_id: "cat-1",
        base_price: 10,
        description: "",
        sale_price: null,
        image_url: null,
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished",
        unit: "piece",
        last_unit_cost: 0,
        cost_unit: "piece",
        updated_at: new Date().toISOString(),
      },
      {
        id: "product-2",
        org_id: "org-1",
        name: "Cappuccino",
        sku: "CAP",
        barcode: "",
        category_id: "cat-1",
        base_price: 12,
        description: "",
        sale_price: null,
        image_url: null,
        is_active: true,
        is_popular: false,
        track_inventory: true,
        product_type: "finished",
        unit: "piece",
        last_unit_cost: 0,
        cost_unit: "piece",
        updated_at: new Date().toISOString(),
      },
    ]);
    vi.mocked(catalogRepo.listVariants)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "variant-1",
          product_id: "product-2",
          name: "Large",
          sku: "CAP-L",
          barcode: "",
          price: null,
          price_delta: 0,
          image_url: null,
          is_active: true,
          variant_kind: "standard",
          quantity_value: null,
          quantity_unit: null,
          price_mode: null,
          fixed_price: null,
        },
      ]);

    await expect(deleteProduct("ingredient-1", "user-1")).rejects.toThrow(
      "لا يمكن حذف هذا المكون لأنه مستخدم في وصفات: Latte، Cappuccino - Large. أزله من هذه الوصفات أولاً."
    );
    expect(catalogRepo.deleteProduct).not.toHaveBeenCalled();
  });
});
