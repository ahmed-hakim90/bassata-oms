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
 */

/** Café + food prep verticals that share a kitchen-style catalog path. */
const FOOD_SERVICE_ACTIVITIES = [
  "cafe",
  "ice_cream",
  "juice_bar",
  "restaurant",
  "bakery",
] as const satisfies readonly BusinessActivityType[];

/**
 * Activities that deduct finished goods via recipes by default.
 * Cafe is food-service adjacent but recipes stay off (simple takeaway catalog).
 */
const RECIPE_DEFAULT_ON_ACTIVITIES = [
  "ice_cream",
  "juice_bar",
  "restaurant",
  "bakery",
] as const satisfies readonly BusinessActivityType[];

const WHOLESALE_CREDIT_ACTIVITIES = [
  "wholesale",
  "mixed",
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
    // B2B wholesale + mixed orgs typically sell on account from day one.
    ...(isActivityIn(activity, WHOLESALE_CREDIT_ACTIVITIES)
      ? { credit_sales: true }
      : {}),
  };
}

/** Recipe / prep module defaults. */
function recipeFeatures(activity: BusinessActivityType): ActivityFlagSlice {
  return {
    recipes: isActivityIn(activity, RECIPE_DEFAULT_ON_ACTIVITIES),
  };
}

/** POS hardware / scan defaults shared across activities. */
function posFeatures(_activity: BusinessActivityType): ActivityFlagSlice {
  return {
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

/** Café / restaurant / bakery lineage — kitchen display + prep enqueue. */
export function isFoodServiceActivity(activity: BusinessActivityType): boolean {
  return isActivityIn(activity, FOOD_SERVICE_ACTIVITIES);
}

/** Modifiers / KDS-style extras — same food-service set (includes ice_cream). */
export function supportsProductModifiers(activity: BusinessActivityType): boolean {
  return isFoodServiceActivity(activity);
}

/**
 * Cafe menu create/edit dialog (variants-first, piece catalog).
 * Weight-first food activities (e.g. bakery with weight on) use the retail product dialog.
 */
export function usesCafeMenuCatalog(
  settings: Pick<BusinessActivitySettings, "activity_type" | "enable_weight_sales">
): boolean {
  return (
    isFoodServiceActivity(settings.activity_type) && !settings.enable_weight_sales
  );
}

/** Variants stay locked for barcode/shelf retail verticals. */
export function variantsLockedByActivity(activity: BusinessActivityType): boolean {
  return activity === "supermarket" || activity === "pharmacy";
}

/** Import/export workbook family. */
export function productImportTemplateGroup(
  activity: BusinessActivityType
): "kitchen" | "supermarket" | "shelf" {
  if (activity === "supermarket") return "supermarket";
  if (isFoodServiceActivity(activity)) return "kitchen";
  return "shelf";
}
