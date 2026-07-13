import type {
  BusinessActivityType,
  ProductTemplate,
  ProductTemplateId,
  ProductTemplateSettings,
  ProductType,
  ProductSalesUnitType,
} from "@/lib/constants";

export const NORMALIZED_PRODUCT_TEMPLATE_IDS = [
  "retail_product",
  "weight_product",
  "ingredient",
  "packaging_material",
  "service",
] as const;

export type NormalizedProductTemplateId = (typeof NORMALIZED_PRODUCT_TEMPLATE_IDS)[number];

export function normalizeProductTemplateId(
  templateId: ProductTemplateId
): NormalizedProductTemplateId {
  switch (templateId) {
    case "supermarket_weight_product":
      return "weight_product";
    case "restaurant_ingredient":
    case "ice_cream_ingredient":
      return "ingredient";
    case "retail_product":
    case "packaging_material":
    case "service":
      return templateId;
    default:
      return "retail_product";
  }
}

/** Default template when opening the new-product form, per business activity. */
export const DEFAULT_PRODUCT_TEMPLATE_ID_BY_ACTIVITY: Record<
  BusinessActivityType,
  ProductTemplateId
> = {
  cafe: "retail_product",
  ice_cream: "ice_cream_ingredient",
  juice_bar: "restaurant_ingredient",
  supermarket: "retail_product",
  restaurant: "retail_product",
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
    return activityType === "supermarket" ? "supermarket_weight_product" : "retail_product";
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
  | "shelf_life_value"
  | "shelf_life_unit"
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
    shelf_life_value: template.shelf_life_value,
    shelf_life_unit: template.shelf_life_unit,
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

export function resolveNormalizedProductTemplateId(
  activityType: BusinessActivityType,
  productType: ProductType,
  salesUnitType?: ProductSalesUnitType
): NormalizedProductTemplateId {
  const templateId = resolveProductTemplateId(activityType, productType, salesUnitType);
  return normalizeProductTemplateId(templateId);
}
