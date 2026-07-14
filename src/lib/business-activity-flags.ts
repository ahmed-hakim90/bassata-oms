import {
  type BusinessActivitySettings,
  type BusinessActivityType,
  type FeatureFlag,
} from "@/lib/constants";

/**
 * Activity → managed feature flags (SSOT).
 *
 * Presets in `ACTIVITY_PRESETS` hold business defaults only
 * (sales modes, weight/wholesale toggles, inventory policies).
 * Runtime feature toggles live HERE — not inside presets.
 *
 * Storage shape stays flat `Partial<Record<FeatureFlag, boolean>>`
 * (Settings / DB / onboarding). Groups below are for readability only —
 * not a capability engine or schema change.
 *
 * Expansion (same enum, later phases):
 * - restaurant → KDS / tables / modifier catalog (when product commits)
 * - supermarket → scale device hooks
 * - wholesale / mixed → deeper AR / invoice policies via flags already owned here
 */

/** Café + food prep verticals that share a kitchen-style catalog path. */
const FOOD_SERVICE_ACTIVITIES = [
  "cafe",
  "ice_cream",
  "juice_bar",
  "restaurant",
] as const satisfies readonly BusinessActivityType[];

/**
 * Activities that deduct finished goods via recipes by default.
 * Cafe is food-service adjacent but recipes stay off (simple takeaway catalog).
 * Turn cafe on later via this set — do not re-add per-activity ifs in callers.
 */
const RECIPE_DEFAULT_ON_ACTIVITIES = [
  "ice_cream",
  "juice_bar",
  "restaurant",
] as const satisfies readonly BusinessActivityType[];

const WHOLESALE_CREDIT_ACTIVITIES = [
  "wholesale",
] as const satisfies readonly BusinessActivityType[];

function isActivityIn<T extends BusinessActivityType>(
  activity: BusinessActivityType,
  list: readonly T[]
): boolean {
  return (list as readonly BusinessActivityType[]).includes(activity);
}

type ActivityFlagSlice = Partial<Record<FeatureFlag, boolean>>;

/** Inventory-adjacent managed flags (expand here: waste defaults, etc.). */
function inventoryFeatures(_activity: BusinessActivityType): ActivityFlagSlice {
  return {};
}

/** Sales / AR defaults driven by activity. */
function salesFeatures(activity: BusinessActivityType): ActivityFlagSlice {
  return {
    // B2B wholesale orgs typically sell on account from day one.
    ...(isActivityIn(activity, WHOLESALE_CREDIT_ACTIVITIES)
      ? { credit_sales: true }
      : {}),
  };
}

/** Recipe / prep module defaults. */
function recipeFeatures(activity: BusinessActivityType): ActivityFlagSlice {
  return {
    // Prep-before-sell businesses: ice cream, juice, restaurant.
    // Cafe deliberately false — enable by adding "cafe" to RECIPE_DEFAULT_ON_ACTIVITIES.
    recipes: isActivityIn(activity, RECIPE_DEFAULT_ON_ACTIVITIES),
  };
}

/** POS hardware / scan defaults shared across activities. */
function posFeatures(_activity: BusinessActivityType): ActivityFlagSlice {
  return {
    // All activities get barcode entry in POS; operators may still disable in Settings.
    barcode_scanner: true,
  };
}

/** Accounting defaults reserved for future period-lock / tax nudges. */
function accountingFeatures(_activity: BusinessActivityType): ActivityFlagSlice {
  return {};
}

/**
 * Feature flags driven by business activity — used by Settings activity
 * update/preset apply and onboarding bootstrap for the same keys.
 *
 * Callers must use this builder; do not read feature toggles from ACTIVITY_PRESETS.
 */
export function buildBusinessActivityFeatureFlags(
  settings: Pick<BusinessActivitySettings, "activity_type">
): Partial<Record<FeatureFlag, boolean>> {
  const activity = settings.activity_type as BusinessActivityType;

  return {
    ...inventoryFeatures(activity),
    ...salesFeatures(activity),
    ...recipeFeatures(activity),
    ...posFeatures(activity),
    ...accountingFeatures(activity),
  };
}

/** @internal test / docs helper — which activities share food-service lineage. */
export function isFoodServiceActivity(activity: BusinessActivityType): boolean {
  return isActivityIn(activity, FOOD_SERVICE_ACTIVITIES);
}
