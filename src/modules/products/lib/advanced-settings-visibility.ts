import type { BusinessActivityType } from "@/lib/constants";
import type { ProductType, ProductSalesUnitType } from "@/lib/constants";
import {
  resolveNormalizedProductTemplateId,
  type NormalizedProductTemplateId,
} from "@/modules/products/lib/apply-product-template";

export const ADVANCED_SETTING_OPTIONS = [
  "inventory_tracking",
  "batch_tracking",
  "expiry_tracking",
  "fefo",
  "fractional_quantity",
] as const;

export type AdvancedSettingOption = (typeof ADVANCED_SETTING_OPTIONS)[number];

type VisibilityOverride = {
  add?: readonly AdvancedSettingOption[];
  remove?: readonly AdvancedSettingOption[];
};

const TEMPLATE_BASE_VISIBILITY: Record<
  NormalizedProductTemplateId,
  readonly AdvancedSettingOption[]
> = {
  retail_product: ["inventory_tracking"],
  weight_product: ["inventory_tracking", "batch_tracking", "expiry_tracking", "fefo"],
  ingredient: ["inventory_tracking", "batch_tracking", "expiry_tracking", "fefo"],
  packaging_material: ["inventory_tracking"],
  service: [],
};

const ACTIVITY_VISIBILITY_OVERRIDES: Partial<
  Record<BusinessActivityType, Partial<Record<NormalizedProductTemplateId, VisibilityOverride>>>
> = {
  cafe: {
    retail_product: { add: ["expiry_tracking"] },
  },
  juice_bar: {
    retail_product: { add: ["batch_tracking", "expiry_tracking", "fefo"] },
  },
  ice_cream: {
    retail_product: { add: ["batch_tracking", "expiry_tracking", "fefo"] },
  },
};

function buildActivityTemplateVisibility(
  activityType: BusinessActivityType,
  normalizedTemplateId: NormalizedProductTemplateId
): Set<AdvancedSettingOption> {
  const visibleOptions = new Set<AdvancedSettingOption>(
    TEMPLATE_BASE_VISIBILITY[normalizedTemplateId]
  );
  const override = ACTIVITY_VISIBILITY_OVERRIDES[activityType]?.[normalizedTemplateId];
  override?.add?.forEach((option) => visibleOptions.add(option));
  override?.remove?.forEach((option) => visibleOptions.delete(option));
  return visibleOptions;
}

export function getVisibleAdvancedSettings(
  activityType: BusinessActivityType,
  normalizedTemplateId: NormalizedProductTemplateId
): Set<AdvancedSettingOption> {
  if (normalizedTemplateId === "service") return new Set();
  return buildActivityTemplateVisibility(activityType, normalizedTemplateId);
}

export function getVisibleAdvancedSettingsForProduct(
  activityType: BusinessActivityType,
  productType: ProductType,
  salesUnitType?: ProductSalesUnitType
): Set<AdvancedSettingOption> {
  const normalizedTemplateId = resolveNormalizedProductTemplateId(
    activityType,
    productType,
    salesUnitType
  );
  return getVisibleAdvancedSettings(activityType, normalizedTemplateId);
}
