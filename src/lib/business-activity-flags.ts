import {
  ACTIVITY_PRESETS,
  type BusinessActivitySettings,
  type BusinessActivityType,
  type FeatureFlag,
} from "@/lib/constants";

/**
 * Feature flags driven by business activity — used by Settings activity
 * update/preset apply and onboarding bootstrap for the same keys.
 */
export function buildBusinessActivityFeatureFlags(
  settings: Pick<BusinessActivitySettings, "activity_type">
): Partial<Record<FeatureFlag, boolean>> {
  const preset = ACTIVITY_PRESETS[settings.activity_type as BusinessActivityType];
  const presetFlags = preset?.featureFlags ?? {};

  return {
    barcode_scanner: true,
    recipes:
      presetFlags.recipes ??
      (settings.activity_type !== "cafe" &&
        settings.activity_type !== "supermarket" &&
        settings.activity_type !== "retail" &&
        settings.activity_type !== "wholesale" &&
        settings.activity_type !== "mixed"),
    ...(presetFlags.credit_sales !== undefined
      ? { credit_sales: presetFlags.credit_sales }
      : {}),
  };
}
