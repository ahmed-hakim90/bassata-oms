import { BUSINESS_ACTIVITY_TYPES, type BusinessActivityType } from "@/lib/constants";
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
  "price_by_amount",
  "fixed_weight_variants",
  "wholesale",
  "serial_number",
  "warranty",
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
  retail_product: ["inventory_tracking", "serial_number", "warranty"],
  weight_product: [
    "inventory_tracking",
    "batch_tracking",
    "expiry_tracking",
    "fefo",
    "fractional_quantity",
    "price_by_amount",
    "fixed_weight_variants",
    "wholesale",
  ],
  ingredient: ["inventory_tracking", "batch_tracking", "expiry_tracking", "fefo"],
  packaging_material: ["inventory_tracking"],
  service: [],
};

const ACTIVITY_VISIBILITY_OVERRIDES: Partial<
  Record<BusinessActivityType, Partial<Record<NormalizedProductTemplateId, VisibilityOverride>>>
> = {
  supermarket: {
    retail_product: { add: ["batch_tracking", "expiry_tracking", "fefo"] },
    packaging_material: { add: ["batch_tracking"] },
  },
  cafe: {
    retail_product: { add: ["expiry_tracking"] },
  },
  restaurant: {
    retail_product: { add: ["batch_tracking", "expiry_tracking", "fefo"] },
  },
  ice_cream: {
    retail_product: { add: ["batch_tracking", "expiry_tracking", "fefo"] },
  },
  wholesale: {
    retail_product: { add: ["wholesale"], remove: ["price_by_amount"] },
    packaging_material: { add: ["wholesale"] },
  },
  retail: {
    retail_product: { remove: ["batch_tracking", "expiry_tracking", "fefo"] },
  },
};

function buildActivityTemplateVisibility(
  activityType: Exclude<BusinessActivityType, "mixed">,
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
  if (activityType !== "mixed") {
    return buildActivityTemplateVisibility(activityType, normalizedTemplateId);
  }

  const merged = new Set<AdvancedSettingOption>();
  for (const activity of BUSINESS_ACTIVITY_TYPES) {
    if (activity === "mixed") continue;
    const visibility = buildActivityTemplateVisibility(activity, normalizedTemplateId);
    visibility.forEach((option) => merged.add(option));
  }
  return merged;
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
