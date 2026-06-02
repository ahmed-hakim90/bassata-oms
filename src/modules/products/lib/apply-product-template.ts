import type {
  BusinessActivityType,
  ProductTemplate,
  ProductTemplateId,
  ProductTemplateSettings,
  ProductType,
  ProductSalesUnitType,
} from "@/lib/constants";

/** Default template when opening the new-product form, per business activity. */
export const DEFAULT_PRODUCT_TEMPLATE_ID_BY_ACTIVITY: Record<
  BusinessActivityType,
  ProductTemplateId
> = {
  cafe: "retail_product",
  ice_cream: "retail_product",
  restaurant: "retail_product",
  supermarket: "retail_product",
  retail: "retail_product",
  wholesale: "retail_product",
  mixed: "retail_product",
};

export function resolveProductTemplateId(
  activityType: BusinessActivityType,
  productType: ProductType,
  salesUnitType?: ProductSalesUnitType
): ProductTemplateId {
  if (productType === "service") return "service";
  if (productType === "packaging_material") return "packaging_material";

  if (productType === "raw_material" || productType === "ingredient") {
    return activityType === "ice_cream" ? "ice_cream_ingredient" : "restaurant_ingredient";
  }

  if (salesUnitType === "weight") {
    if (
      activityType === "supermarket" ||
      activityType === "wholesale" ||
      activityType === "mixed"
    ) {
      return "supermarket_weight_product";
    }
  }

  return DEFAULT_PRODUCT_TEMPLATE_ID_BY_ACTIVITY[activityType];
}

export type ProductTemplateFormSlice = Pick<
  ProductTemplate,
  | "product_type"
  | "sales_unit_type"
  | "unit"
  | "base_unit"
  | "sale_unit"
  | "inventory_tracking_mode"
  | "inventory_rotation_method"
  | "expiry_policy"
  | "expiry_tracking_enabled"
  | "shelf_life_days"
  | "shelf_life_months"
  | "shelf_life_years"
  | "allow_fractional_quantity"
  | "allow_price_input"
  | "track_inventory"
  | "wholesale_enabled"
>;

export function productTemplateToFormValues(
  template: ProductTemplate
): ProductTemplateFormSlice {
  return {
    product_type: template.product_type,
    sales_unit_type: template.sales_unit_type,
    unit: template.unit,
    base_unit: template.base_unit,
    sale_unit: template.sale_unit,
    inventory_tracking_mode: template.inventory_tracking_mode,
    inventory_rotation_method: template.inventory_rotation_method,
    expiry_policy: template.expiry_policy,
    expiry_tracking_enabled: template.expiry_tracking_enabled,
    shelf_life_days: template.shelf_life_days,
    shelf_life_months: template.shelf_life_months,
    shelf_life_years: template.shelf_life_years,
    allow_fractional_quantity: template.allow_fractional_quantity,
    allow_price_input: template.allow_price_input,
    track_inventory: template.track_inventory,
    wholesale_enabled: template.wholesale_enabled,
  };
}

export function getTemplateFromSettings(
  templates: ProductTemplateSettings,
  activityType: BusinessActivityType,
  productType: ProductType,
  salesUnitType?: ProductSalesUnitType
): ProductTemplate {
  const id = resolveProductTemplateId(activityType, productType, salesUnitType);
  return templates[id];
}
